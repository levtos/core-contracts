from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest

from custom_components.benni_core_contracts.models import (
    Device,
    DeviceOverrides,
    ProfileId,
    SourceBinding,
    SourceCadence,
)
from custom_components.benni_core_contracts.registry import (
    RegistryPayload,
    registry_checksum,
)
from custom_components.benni_core_contracts.registry_service import (
    InvalidReferenceError,
    RegistryDomainService,
)
from custom_components.benni_core_contracts.registry_store import (
    InMemoryLastKnownGoodCache,
    PostgresRegistryRepository,
)
from custom_components.benni_core_contracts.registry_transfer import (
    decode_document,
    export_document,
)
from tests.test_registry_store import _PostgresFake


def binding(**changes):
    values = {
        "binding_id": "door",
        "source_id": "source.door",
        "entity_id": "binary_sensor.door",
        "field": "is_open",
        "capability": "opening",
    }
    values.update(changes)
    return SourceBinding(**values)


def test_v1_roundtrip_and_checksum_remain_byte_stable_without_device_fields():
    original = RegistryPayload(profile=ProfileId.BENNI, bindings=(binding(),))
    encoded = original.as_dict()
    checksum = registry_checksum(original)

    assert original.schema_version == 1
    assert "devices" not in encoded
    assert "device_id" not in encoded["bindings"][0]
    assert RegistryPayload.from_dict(encoded).as_dict() == encoded
    assert registry_checksum(RegistryPayload.from_dict(encoded)) == checksum


def test_v2_roundtrip_preserves_device_and_nullable_binding_overrides():
    device = Device(
        device_id="device-1",
        source_cadence=SourceCadence.EVENT_BASED,
        liveness_entity="sensor.door_last_seen",
    )
    payload = RegistryPayload(
        profile=ProfileId.BENNI,
        schema_version=2,
        devices=(device,),
        bindings=(
            binding(
                device_id="device-1",
                device_overrides=DeviceOverrides(
                    {"expected_interval_s": None, "liveness_entity": None}
                ),
            ),
        ),
    )
    restored = RegistryPayload.from_dict(payload.as_dict())
    assert restored == payload
    assert restored.bindings[0].device_overrides.as_dict() == {
        "expected_interval_s": None,
        "liveness_entity": None,
    }
    assert decode_document(export_document(payload), "benni") == payload


def test_unrelated_edit_of_existing_v1_draft_preserves_schema_version():
    now = datetime(2026, 9, 14, tzinfo=timezone.utc)
    database = _PostgresFake()
    store = PostgresRegistryRepository(
        database,
        lkg_cache=InMemoryLastKnownGoodCache(),
        now_factory=lambda: now,
    )
    legacy = RegistryPayload(profile=ProfileId.BENNI, bindings=(binding(),))
    candidate = asyncio.run(store.create_revision(legacy))
    asyncio.run(store.activate_revision(candidate.id, expected_base_revision=0))
    service = RegistryDomainService(store, now_factory=lambda: now)

    draft = asyncio.run(service.async_open_draft())
    draft = asyncio.run(
        service.async_update_binding(
            draft.draft_id, "door", {"display_name": "Door contact"}
        )
    )

    assert draft.payload.schema_version == 1
    assert "devices" not in draft.payload.as_dict()


def test_explicit_device_edit_upgrades_draft_but_does_not_activate_revision():
    now = datetime(2026, 9, 14, tzinfo=timezone.utc)
    database = _PostgresFake()
    service = RegistryDomainService(
        PostgresRegistryRepository(
            database,
            lkg_cache=InMemoryLastKnownGoodCache(),
            now_factory=lambda: now,
        ),
        now_factory=lambda: now,
    )

    draft = asyncio.run(service.async_open_draft())
    assert draft.payload.schema_version == 2
    draft = asyncio.run(
        service.async_create_device(
            draft.draft_id,
            {"device_id": "device-1", "source_cadence": "event_based"},
        )
    )
    assert draft.payload.devices[0].device_id == "device-1"
    assert database.rows == {}

    draft = asyncio.run(
        service.async_create_binding(
            draft.draft_id,
            binding(device_id="device-1"),
        )
    )
    with pytest.raises(InvalidReferenceError):
        asyncio.run(service.async_delete_device(draft.draft_id, "device-1"))
