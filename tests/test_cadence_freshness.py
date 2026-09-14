from __future__ import annotations

import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from custom_components.benni_core_contracts.const import (
    DEFAULT_EVENT_BASED_EXPECTED_INTERVAL_SECONDS,
    PILOT_OPENING_CONTRACT_ID,
    PILOT_OPENING_ENTITY_ID,
    PILOT_OPENING_SOURCE_ENTITY_IDS,
)
from custom_components.benni_core_contracts.consumer_api import (
    ConsumerApi,
    ConsumerEventKind,
    ConsumerRequirement,
)
from custom_components.benni_core_contracts.graph import SignalGraph
from custom_components.benni_core_contracts.live_evidence import (
    LiveEvidenceStatus,
    assess_live_source,
)
from custom_components.benni_core_contracts.models import (
    CadenceProvenance,
    ConfigModel,
    Device,
    DeviceOverrides,
    ProfileId,
    RawObservation,
    RuntimeMode,
    SourceCadence,
)
from custom_components.benni_core_contracts.published import (
    build_pilot_fusions,
    pilot_opening_bindings,
)
from custom_components.benni_core_contracts.quality import (
    CadenceSource,
    FreshnessBasis,
    FreshnessOrigin,
    FreshnessStatus,
    LivenessEvidence,
    LivenessStatus,
    TemporalEvidence,
    assess_effective_freshness,
)
from custom_components.benni_core_contracts.registry_service import RegistryRuntime
from custom_components.benni_core_contracts.registry import (
    RegistryPayload,
    RegistryRevision,
    RevisionStatus,
)
from custom_components.benni_core_contracts.source_binding_evidence import (
    assess_source_binding_evidence,
    source_binding_matrix_v1,
)
from tests.live_evidence_fixtures import (
    LIVE_FIXTURE_NOW,
    matrix_record,
    stale_opening_snapshot,
)


UTC = timezone.utc
NOW = datetime(2026, 9, 14, 10, 0, tzinfo=UTC)
LIVENESS_ENTITY = "sensor.kitchen_patio_door_last_seen"


def value_evidence(*, age_seconds: int = 7200, state_event: bool = True) -> TemporalEvidence:
    return TemporalEvidence(
        received_at=NOW,
        origin=FreshnessOrigin.HA_TIMESTAMP,
        ha_timestamp=NOW - timedelta(seconds=age_seconds),
        ha_state_event=state_event,
    )


def liveness(
    *,
    age_seconds: int = 60,
    state: str | None = None,
) -> LivenessEvidence:
    timestamp = NOW - timedelta(seconds=age_seconds)
    return LivenessEvidence(
        entity_id=LIVENESS_ENTITY,
        observed_at=NOW,
        timestamp=timestamp if state not in {"unknown", "unavailable"} else None,
        state=state or timestamp.isoformat(),
    )


def resolved(
    cadence: SourceCadence,
    *,
    heartbeat: LivenessEvidence | None = None,
    evidence: TemporalEvidence | None = None,
    interval: int = 3600,
):
    return assess_effective_freshness(
        evidence or value_evidence(),
        now=NOW,
        ttl_seconds=600,
        cadence=cadence.value,
        cadence_source=CadenceSource.DEVICE,
        cadence_provenance="manual",
        expected_interval_s=interval,
        liveness_entity=LIVENESS_ENTITY,
        liveness_evidence=heartbeat,
    )


def opening_graph(
    cadence: SourceCadence,
    *,
    heartbeat: LivenessEvidence | None,
    override: SourceCadence | None = None,
) -> SignalGraph:
    raw_bindings = pilot_opening_bindings(*PILOT_OPENING_SOURCE_ENTITY_IDS)
    bindings = tuple(
        replace(
            binding,
            device_id="device.opening",
            device_overrides=(
                DeviceOverrides({"source_cadence": override.value})
                if override is not None
                else DeviceOverrides()
            ),
        )
        for binding in raw_bindings
    )
    config = ConfigModel(
        profile=ProfileId.BENNI,
        mode=RuntimeMode.PUBLISHED,
        entity_allowlist=(PILOT_OPENING_ENTITY_ID,),
        published_contracts=(PILOT_OPENING_CONTRACT_ID,),
        bindings=bindings,
    )
    device = Device(
        device_id="device.opening",
        source_cadence=cadence,
        expected_interval_s=3600,
        liveness_entity=LIVENESS_ENTITY,
        cadence_provenance=CadenceProvenance("manual"),
    )
    graph = SignalGraph(profile=ProfileId.BENNI, devices=(device,))
    for binding in bindings:
        graph.add_binding(binding)
    graph.add_fusions(build_pilot_fusions(config))
    if heartbeat is not None:
        graph.update_liveness(heartbeat)
    for binding in bindings:
        graph.ingest(
            binding.binding_id,
            RawObservation(
                source_id=binding.source_id,
                entity_id=binding.entity_id,
                value="off",
                evidence=value_evidence(),
            ),
            now=NOW,
        )
    return graph


class CadenceFreshnessTests(unittest.TestCase):
    def test_periodic_and_unknown_keep_legacy_ttl_behavior(self) -> None:
        for cadence in (SourceCadence.PERIODIC, SourceCadence.UNKNOWN):
            with self.subTest(cadence=cadence.value):
                assessment = resolved(cadence, heartbeat=liveness())
                self.assertEqual(assessment.freshness, FreshnessStatus.STALE)
                self.assertEqual(assessment.basis, FreshnessBasis.TTL)
                self.assertEqual(assessment.liveness_status, LivenessStatus.NOT_APPLICABLE)

    def test_event_based_liveness_has_alive_overdue_and_unknown_states(self) -> None:
        alive = resolved(SourceCadence.EVENT_BASED, heartbeat=liveness())
        overdue = resolved(
            SourceCadence.EVENT_BASED,
            heartbeat=liveness(age_seconds=7200),
        )
        self.assertEqual((alive.freshness, alive.liveness_status), (FreshnessStatus.FRESH, LivenessStatus.ALIVE))
        self.assertEqual((overdue.freshness, overdue.liveness_status), (FreshnessStatus.STALE, LivenessStatus.OVERDUE))

        cases = (
            (liveness(age_seconds=-1), "liveness_timestamp_in_future"),
            (liveness(age_seconds=36001), "liveness_timestamp_implausibly_old"),
            (liveness(state="unknown"), "liveness_entity_unknown"),
            (liveness(state="unavailable"), "liveness_entity_unavailable"),
        )
        for heartbeat, reason in cases:
            with self.subTest(reason=reason):
                assessment = resolved(SourceCadence.EVENT_BASED, heartbeat=heartbeat)
                self.assertEqual(assessment.freshness, FreshnessStatus.UNKNOWN)
                self.assertEqual(assessment.liveness_status, LivenessStatus.UNKNOWN)
                self.assertEqual(assessment.reason, reason)

    def test_event_based_opening_uses_device_liveness_and_binding_override_wins(self) -> None:
        event_graph = opening_graph(SourceCadence.EVENT_BASED, heartbeat=liveness())
        event_contract = event_graph.evaluate_contract(PILOT_OPENING_CONTRACT_ID, "opening", now=NOW)
        self.assertEqual(event_contract.values["opening_state"], "closed")
        assessment = event_contract.field_quality["opening_state"].freshness_assessment
        self.assertIsNotNone(assessment)
        self.assertEqual(assessment.freshness, FreshnessStatus.FRESH)
        self.assertEqual(assessment.shared_binding_count, 2)
        diagnostic = event_graph.diagnostic(PILOT_OPENING_CONTRACT_ID)
        self.assertIsNotNone(diagnostic)
        diagnostic_field = next(
            field
            for field in diagnostic.as_dict(NOW)["fields"]
            if field["field"] == "opening_state"
        )
        diagnostic_assessment = diagnostic_field["freshness_assessment"]
        self.assertEqual(diagnostic_assessment["cadence"], "event_based")
        self.assertEqual(diagnostic_assessment["cadence_source"], "device")
        self.assertEqual(diagnostic_assessment["liveness_status"], "alive")
        self.assertEqual(diagnostic_assessment["shared_binding_count"], 2)
        self.assertEqual(diagnostic_assessment["value_age_seconds"], 7200)
        self.assertEqual(diagnostic_assessment["liveness_age_seconds"], 60)

        override_graph = opening_graph(
            SourceCadence.PERIODIC,
            heartbeat=liveness(),
            override=SourceCadence.EVENT_BASED,
        )
        override_contract = override_graph.evaluate_contract(PILOT_OPENING_CONTRACT_ID, "opening", now=NOW)
        override_assessment = override_contract.field_quality["opening_state"].freshness_assessment
        self.assertEqual(override_contract.values["opening_state"], "closed")
        self.assertEqual(override_assessment.cadence_source, CadenceSource.BINDING_OVERRIDE)

    def test_periodic_and_legacy_openings_remain_stale(self) -> None:
        periodic = opening_graph(SourceCadence.PERIODIC, heartbeat=liveness())
        periodic_contract = periodic.evaluate_contract(PILOT_OPENING_CONTRACT_ID, "opening", now=NOW)
        self.assertEqual(periodic_contract.values["opening_state"], "unknown")
        self.assertEqual(periodic_contract.field_quality["opening_state"].freshness, FreshnessStatus.STALE)

        legacy_config = ConfigModel(
            profile=ProfileId.BENNI,
            mode=RuntimeMode.PUBLISHED,
            entity_allowlist=(PILOT_OPENING_ENTITY_ID,),
            published_contracts=(PILOT_OPENING_CONTRACT_ID,),
            bindings=pilot_opening_bindings(*PILOT_OPENING_SOURCE_ENTITY_IDS),
        )
        legacy = SignalGraph.from_config(legacy_config)
        for binding in legacy_config.bindings:
            legacy.ingest(
                binding.binding_id,
                RawObservation(binding.source_id, binding.entity_id, "off", value_evidence()),
                now=NOW,
            )
        legacy_contract = legacy.evaluate_contract(PILOT_OPENING_CONTRACT_ID, "opening", now=NOW)
        self.assertEqual(legacy_contract.values["opening_state"], "unknown")
        self.assertEqual(legacy_contract.field_quality["opening_state"].freshness, FreshnessStatus.STALE)
        self.assertIsNone(legacy_contract.field_quality["opening_state"].freshness_assessment)

    def test_unknown_liveness_is_consistent_across_selection_quality_and_fallback(self) -> None:
        graph = opening_graph(
            SourceCadence.EVENT_BASED,
            heartbeat=liveness(state="unavailable"),
        )
        contract = graph.evaluate_contract(PILOT_OPENING_CONTRACT_ID, "opening", now=NOW)
        quality = contract.field_quality["opening_state"]
        self.assertEqual(contract.values["opening_state"], "unknown")
        self.assertEqual(contract.field_evaluations["opening_state"].note, "opening_source_not_fresh")
        self.assertEqual(quality.freshness, FreshnessStatus.UNKNOWN)
        self.assertEqual(quality.freshness_assessment.liveness_status, LivenessStatus.UNKNOWN)
        self.assertEqual(quality.freshness_assessment.reason, "liveness_entity_unavailable")
        self.assertIn("source_liveness_unknown", {reason.code for reason in quality.reasons})

    def test_current_liveness_cannot_bypass_hard_source_evidence_gates(self) -> None:
        record = next(
            item
            for item in source_binding_matrix_v1().records
            if item.source_entity is not None
            and FreshnessOrigin.HA_TIMESTAMP in item.allowed_freshness_origins
            and item.ha_state_change_usable is True
        )
        cases = (
            (
                TemporalEvidence(NOW, FreshnessOrigin.RESTORE, restored=True),
                "source_restored",
            ),
            (
                TemporalEvidence(NOW, FreshnessOrigin.RETAINED_MQTT, retained=True),
                "source_retained",
            ),
            (
                TemporalEvidence(NOW, FreshnessOrigin.UNKNOWN),
                "source_freshness_origin_not_allowed",
            ),
            (value_evidence(state_event=False), "ha_state_change_not_evidenced"),
        )
        for evidence, reason in cases:
            with self.subTest(reason=reason):
                resolved_assessment = resolved(
                    SourceCadence.EVENT_BASED,
                    heartbeat=liveness(),
                    evidence=evidence,
                )
                self.assertNotEqual(
                    resolved_assessment.freshness,
                    FreshnessStatus.FRESH,
                )
                assessment = assess_source_binding_evidence(
                    record,
                    evidence,
                    now=NOW,
                    ttl_seconds=600,
                    freshness_assessment=resolved_assessment,
                )
                self.assertFalse(assessment.accepted)
                self.assertNotEqual(assessment.freshness, FreshnessStatus.FRESH)
                self.assertEqual(assessment.reason, reason)
                self.assertIsNotNone(assessment.freshness_assessment)
                self.assertNotEqual(
                    assessment.freshness_assessment.freshness,
                    FreshnessStatus.FRESH,
                )

    def test_liveness_details_do_not_emit_quality_changed(self) -> None:
        graph = opening_graph(SourceCadence.EVENT_BASED, heartbeat=liveness(age_seconds=60))
        graph.evaluate_contract(PILOT_OPENING_CONTRACT_ID, "opening", now=NOW)
        bindings = graph.bindings()
        device = Device(
            device_id="device.opening",
            source_cadence=SourceCadence.EVENT_BASED,
            expected_interval_s=3600,
            liveness_entity=LIVENESS_ENTITY,
        )
        config = RegistryPayload(
            profile=ProfileId.BENNI,
            schema_version=2,
            bindings=bindings,
            devices=(device,),
            fusions=build_pilot_fusions(
                ConfigModel(
                    profile=ProfileId.BENNI,
                    mode=RuntimeMode.PUBLISHED,
                    entity_allowlist=(PILOT_OPENING_ENTITY_ID,),
                    published_contracts=(PILOT_OPENING_CONTRACT_ID,),
                    bindings=bindings,
                )
            ),
            contract_instances=(
                {"contract_id": PILOT_OPENING_CONTRACT_ID, "schema_id": "opening", "schema_version": 1},
            ),
        )
        revision = RegistryRevision(
            id="cadence-revision",
            revision=1,
            profile=ProfileId.BENNI,
            schema_version=2,
            payload=config,
            status=RevisionStatus.ACTIVE,
            created_at=NOW,
            activated_at=NOW,
        )
        runtime = RegistryRuntime()
        runtime.activate(revision, graph)
        api = ConsumerApi(runtime, now_factory=lambda: NOW)
        api.register_consumer(
            "opening-test",
            (ConsumerRequirement(contract_id=PILOT_OPENING_CONTRACT_ID),),
        )
        updates = []
        api.subscribe("opening-test", updates.append, contract_id=PILOT_OPENING_CONTRACT_ID)
        graph.update_liveness(liveness(age_seconds=30))
        self.assertFalse(
            any(ConsumerEventKind.QUALITY_CHANGED in update.event_kinds for update in updates)
        )
        api.close()

    def test_snapshot_stale_override_does_not_replace_event_based_liveness(self) -> None:
        record = matrix_record("benni_opening_kitchen_patio_open")
        snapshot = stale_opening_snapshot()
        temporal = snapshot.temporal_evidence(LIVE_FIXTURE_NOW)
        heartbeat = LivenessEvidence(
            entity_id=LIVENESS_ENTITY,
            observed_at=LIVE_FIXTURE_NOW,
            timestamp=LIVE_FIXTURE_NOW - timedelta(seconds=30),
            state=(LIVE_FIXTURE_NOW - timedelta(seconds=30)).isoformat(),
        )
        event_assessment = assess_effective_freshness(
            temporal,
            now=LIVE_FIXTURE_NOW,
            ttl_seconds=900,
            cadence=SourceCadence.EVENT_BASED.value,
            cadence_source=CadenceSource.DEVICE,
            expected_interval_s=3600,
            liveness_entity=LIVENESS_ENTITY,
            liveness_evidence=heartbeat,
        )
        event_result = assess_live_source(
            record,
            snapshot,
            checked_at=LIVE_FIXTURE_NOW,
            freshness_assessment=event_assessment,
        )
        self.assertEqual(event_result.status, LiveEvidenceStatus.PASS)
        self.assertEqual(event_result.freshness, FreshnessStatus.FRESH)

        periodic_assessment = assess_effective_freshness(
            temporal,
            now=LIVE_FIXTURE_NOW,
            ttl_seconds=900,
            cadence=SourceCadence.PERIODIC.value,
            cadence_source=CadenceSource.DEVICE,
        )
        periodic_result = assess_live_source(
            record,
            snapshot,
            checked_at=LIVE_FIXTURE_NOW,
            freshness_assessment=periodic_assessment,
        )
        self.assertEqual(periodic_result.status, LiveEvidenceStatus.BLOCKED)
        self.assertEqual(periodic_result.freshness, FreshnessStatus.STALE)

    def test_preliminary_event_default_is_used_when_interval_is_omitted(self) -> None:
        binding = replace(
            pilot_opening_bindings(*PILOT_OPENING_SOURCE_ENTITY_IDS)[0],
            device_id="device.default-interval",
        )
        device = Device(
            device_id="device.default-interval",
            source_cadence=SourceCadence.EVENT_BASED,
            liveness_entity=LIVENESS_ENTITY,
        )
        graph = SignalGraph(devices=(device,))
        graph.add_binding(binding)
        graph.update_liveness(liveness(age_seconds=3600))
        graph.ingest(
            binding.binding_id,
            RawObservation(binding.source_id, binding.entity_id, "off", value_evidence()),
            now=NOW,
        )
        assessment = graph.assess_binding_freshness(binding.binding_id, now=NOW)
        self.assertEqual(assessment.freshness, FreshnessStatus.FRESH)
        self.assertEqual(
            assessment.expected_interval_s,
            DEFAULT_EVENT_BASED_EXPECTED_INTERVAL_SECONDS,
        )


if __name__ == "__main__":
    unittest.main()
