"""Quality, freshness, fallback, health, and safety primitives.

These types intentionally model evidence rather than making policy decisions.
The integration can report that a field is unsafe to consume, but it never
executes an action because of that report.
"""

from __future__ import annotations

from dataclasses import dataclass, field as dataclass_field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Iterable

from .const import LIVENESS_IMPLAUSIBLE_AGE_MULTIPLIER


class FreshnessOrigin(str, Enum):
    """Evidence source used to decide whether an observation is current."""

    DEVICE_TIMESTAMP = "device_timestamp"
    HA_TIMESTAMP = "ha_timestamp"
    RETAINED_MQTT = "retained_mqtt"
    UNKNOWN = "unknown"
    RESTORE = "restore"


class FreshnessStatus(str, Enum):
    FRESH = "fresh"
    SUSPECT = "suspect"
    STALE = "stale"
    UNKNOWN = "unknown"
    RESTORED = "restored"


class LivenessStatus(str, Enum):
    """Independent result of checking a configured device heartbeat."""

    NOT_APPLICABLE = "not_applicable"
    ALIVE = "alive"
    OVERDUE = "overdue"
    UNKNOWN = "unknown"


class FreshnessBasis(str, Enum):
    TTL = "ttl"
    DEVICE_LIVENESS = "device_liveness"


class CadenceSource(str, Enum):
    BINDING_OVERRIDE = "binding_override"
    DEVICE = "device"
    LEGACY_UNKNOWN = "legacy_unknown"


class FreshnessRequirement(str, Enum):
    """Minimum temporal evidence accepted by a contract field."""

    DEVICE_OR_HA_EVENT = "device_or_ha_event"
    DEVICE_TIMESTAMP_REQUIRED = "device_timestamp_required"


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    BLOCKED = "blocked"
    UNKNOWN = "unknown"


class QualityStatus(str, Enum):
    """Quality is separate from health and from temporal freshness."""

    GOOD = "good"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"
    UNKNOWN = "unknown"
    CONFLICT = "conflict"
    SUSPECT = "suspect"
    STALE = "stale"


class ValueState(str, Enum):
    """Factual field state, kept separate from quality metadata."""

    VALID = "valid"
    UNKNOWN = "unknown"
    UNAVAILABLE = "unavailable"
    BLOCKED = "blocked"
    INVALID = "invalid"


class SafetyClass(str, Enum):
    INFORMATIONAL = "informational"
    SAFETY_RELEVANT = "safety_relevant"
    CONSUMER_CRITICAL = "consumer_critical"


class SafetyStatus(str, Enum):
    VALID = "valid"
    CONSERVATIVE = "conservative"
    UNSAFE = "unsafe"
    BLOCKED = "blocked"
    UNKNOWN = "unknown"


class FallbackAction(str, Enum):
    NONE = "none"
    HOLD_LAST = "hold_last"
    SAFE_DEFAULT = "safe_default"
    REJECT = "reject"


def utc_now() -> datetime:
    """Return an aware UTC timestamp for deterministic domain comparisons."""

    return datetime.now(timezone.utc)


def _parse_datetime(value: Any) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValueError(f"timestamp must be ISO text, got {type(value).__name__}")
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


@dataclass(frozen=True)
class TemporalEvidence:
    """Timestamps and transport flags attached to one raw observation.

    ``received_at`` is only an ingestion timestamp. It is deliberately never
    promoted to a fresh device measurement timestamp. Restore and retained
    MQTT evidence are explicit origins and therefore cannot become fresh.
    """

    received_at: datetime
    origin: FreshnessOrigin = FreshnessOrigin.UNKNOWN
    device_timestamp: datetime | None = None
    ha_timestamp: datetime | None = None
    retained: bool = False
    restored: bool = False
    ha_state_event: bool = False

    def __post_init__(self) -> None:
        if self.received_at.tzinfo is None:
            raise ValueError("received_at must be timezone-aware")
        if self.device_timestamp and self.device_timestamp.tzinfo is None:
            raise ValueError("device_timestamp must be timezone-aware")
        if self.ha_timestamp and self.ha_timestamp.tzinfo is None:
            raise ValueError("ha_timestamp must be timezone-aware")

    @property
    def effective_timestamp(self) -> datetime | None:
        if self.restored or self.origin == FreshnessOrigin.RESTORE:
            return None
        if self.origin == FreshnessOrigin.DEVICE_TIMESTAMP:
            return self.device_timestamp
        if self.origin == FreshnessOrigin.HA_TIMESTAMP:
            return self.ha_timestamp
        return None

    @property
    def is_real_measurement_evidence(self) -> bool:
        return (
            not self.restored
            and not self.retained
            and (
                self.origin == FreshnessOrigin.DEVICE_TIMESTAMP
                or (
                    self.origin == FreshnessOrigin.HA_TIMESTAMP
                    and self.ha_state_event
                )
            )
            and self.effective_timestamp is not None
        )

    def freshness(
        self,
        now: datetime,
        ttl_seconds: int,
        requirement: FreshnessRequirement = FreshnessRequirement.DEVICE_OR_HA_EVENT,
    ) -> tuple[FreshnessStatus, str | None]:
        """Classify freshness without treating restore or transport replay as current."""

        if self.restored or self.origin == FreshnessOrigin.RESTORE:
            return FreshnessStatus.RESTORED, "restore_value_is_not_fresh"
        if self.origin == FreshnessOrigin.RETAINED_MQTT or self.retained:
            return FreshnessStatus.SUSPECT, "retained_mqtt_is_not_fresh_evidence"
        if self.origin == FreshnessOrigin.HA_TIMESTAMP and not self.ha_state_event:
            return FreshnessStatus.UNKNOWN, "ha_timestamp_without_state_event"
        if (
            requirement == FreshnessRequirement.DEVICE_TIMESTAMP_REQUIRED
            and self.origin != FreshnessOrigin.DEVICE_TIMESTAMP
        ):
            return FreshnessStatus.UNKNOWN, "device_timestamp_required"
        timestamp = self.effective_timestamp
        if timestamp is None:
            return FreshnessStatus.UNKNOWN, "freshness_timestamp_unknown"
        age = (now - timestamp).total_seconds()
        if age < 0:
            return FreshnessStatus.SUSPECT, "freshness_timestamp_in_future"
        if age > ttl_seconds:
            return FreshnessStatus.STALE, "freshness_ttl_exceeded"
        return FreshnessStatus.FRESH, None

    def as_dict(self) -> dict[str, Any]:
        def iso(value: datetime | None) -> str | None:
            return value.isoformat() if value else None

        return {
            "received_at": iso(self.received_at),
            "origin": self.origin.value,
            "device_timestamp": iso(self.device_timestamp),
            "ha_timestamp": iso(self.ha_timestamp),
            "retained": self.retained,
            "restored": self.restored,
            "ha_state_event": self.ha_state_event,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TemporalEvidence":
        return cls(
            received_at=_parse_datetime(data["received_at"]) or utc_now(),
            origin=FreshnessOrigin(data.get("origin", FreshnessOrigin.UNKNOWN.value)),
            device_timestamp=_parse_datetime(data.get("device_timestamp")),
            ha_timestamp=_parse_datetime(data.get("ha_timestamp")),
            retained=bool(data.get("retained", False)),
            restored=bool(data.get("restored", False)),
            ha_state_event=bool(data.get("ha_state_event", False)),
        )


@dataclass(frozen=True)
class LivenessEvidence:
    """One read-only observation of a configured timestamp entity."""

    entity_id: str
    observed_at: datetime
    timestamp: datetime | None = None
    state: str | None = None

    def __post_init__(self) -> None:
        if self.observed_at.tzinfo is None:
            raise ValueError("liveness observed_at must be timezone-aware")
        if self.timestamp is not None and self.timestamp.tzinfo is None:
            raise ValueError("liveness timestamp must be timezone-aware")


@dataclass(frozen=True)
class FreshnessAssessment:
    """Resolved freshness plus orthogonal cadence/liveness diagnostics."""

    freshness: FreshnessStatus
    reason: str | None
    basis: FreshnessBasis
    cadence: str
    cadence_source: CadenceSource
    cadence_provenance: str | None
    value_timestamp: datetime | None
    value_timestamp_origin: FreshnessOrigin
    ttl_seconds: int
    expected_interval_s: int | None = None
    liveness_entity: str | None = None
    liveness_status: LivenessStatus = LivenessStatus.NOT_APPLICABLE
    liveness_timestamp: datetime | None = None
    plausibility_reason: str | None = None
    shared_binding_count: int = 1

    def as_dict(self, now: datetime | None = None) -> dict[str, Any]:
        def age(value: datetime | None) -> int | None:
            if value is None or now is None:
                return None
            return int((now - value).total_seconds())

        return {
            "status": self.freshness.value,
            "reason": self.reason,
            "basis": self.basis.value,
            "cadence": self.cadence,
            "cadence_source": self.cadence_source.value,
            "cadence_provenance": self.cadence_provenance,
            "value_timestamp": (
                self.value_timestamp.isoformat() if self.value_timestamp else None
            ),
            "value_timestamp_origin": self.value_timestamp_origin.value,
            "value_age_seconds": age(self.value_timestamp),
            "ttl_seconds": self.ttl_seconds,
            "expected_interval_s": self.expected_interval_s,
            "liveness_configured": self.liveness_entity is not None,
            "liveness_entity": self.liveness_entity,
            "liveness_status": self.liveness_status.value,
            "liveness_timestamp": (
                self.liveness_timestamp.isoformat()
                if self.liveness_timestamp
                else None
            ),
            "liveness_age_seconds": age(self.liveness_timestamp),
            "plausibility_reason": self.plausibility_reason,
            "shared_binding_count": self.shared_binding_count,
        }


_HARD_FRESHNESS_REASONS = frozenset(
    {
        "restore_value_is_not_fresh",
        "retained_mqtt_is_not_fresh_evidence",
        "ha_timestamp_without_state_event",
        "device_timestamp_required",
        "freshness_timestamp_unknown",
        "freshness_timestamp_in_future",
    }
)


def assess_effective_freshness(
    evidence: TemporalEvidence,
    *,
    now: datetime,
    ttl_seconds: int,
    requirement: FreshnessRequirement = FreshnessRequirement.DEVICE_OR_HA_EVENT,
    cadence: str = "unknown",
    cadence_source: CadenceSource = CadenceSource.LEGACY_UNKNOWN,
    cadence_provenance: str | None = None,
    expected_interval_s: int | None = None,
    liveness_entity: str | None = None,
    liveness_evidence: LivenessEvidence | None = None,
    shared_binding_count: int = 1,
) -> FreshnessAssessment:
    """Resolve TTL or event-based liveness without weakening hard gates."""

    legacy_status, legacy_reason = evidence.freshness(now, ttl_seconds, requirement)
    common = {
        "cadence": cadence,
        "cadence_source": cadence_source,
        "cadence_provenance": cadence_provenance,
        "value_timestamp": evidence.effective_timestamp,
        "value_timestamp_origin": evidence.origin,
        "ttl_seconds": ttl_seconds,
        "expected_interval_s": expected_interval_s,
        "liveness_entity": liveness_entity,
        "shared_binding_count": shared_binding_count,
    }
    if cadence != "event_based":
        return FreshnessAssessment(
            freshness=legacy_status,
            reason=legacy_reason,
            basis=FreshnessBasis.TTL,
            **common,
        )

    liveness_status = LivenessStatus.UNKNOWN
    liveness_timestamp = None
    plausibility_reason = None
    liveness_reason = "liveness_entity_not_configured"
    if liveness_entity is not None and liveness_evidence is None:
        liveness_reason = "liveness_evidence_unavailable"
    elif liveness_evidence is not None:
        liveness_timestamp = liveness_evidence.timestamp
        state = (liveness_evidence.state or "").casefold()
        if state == "unavailable":
            liveness_reason = "liveness_entity_unavailable"
        elif state == "unknown":
            liveness_reason = "liveness_entity_unknown"
        elif liveness_timestamp is None:
            liveness_reason = "liveness_timestamp_invalid"
        elif expected_interval_s is None:
            liveness_reason = "liveness_interval_unknown"
        else:
            liveness_age = (now - liveness_timestamp).total_seconds()
            if liveness_age < 0:
                liveness_reason = "liveness_timestamp_in_future"
                plausibility_reason = liveness_reason
            elif (
                liveness_age
                > expected_interval_s * LIVENESS_IMPLAUSIBLE_AGE_MULTIPLIER
            ):
                liveness_reason = "liveness_timestamp_implausibly_old"
                plausibility_reason = liveness_reason
            elif liveness_age > expected_interval_s:
                liveness_status = LivenessStatus.OVERDUE
                liveness_reason = "liveness_interval_exceeded"
            else:
                liveness_status = LivenessStatus.ALIVE
                liveness_reason = None

    # Restore, retained transport, disallowed/missing timestamp proof, and
    # implausible value timestamps remain authoritative before liveness.
    if legacy_reason in _HARD_FRESHNESS_REASONS:
        return FreshnessAssessment(
            freshness=legacy_status,
            reason=legacy_reason,
            basis=FreshnessBasis.DEVICE_LIVENESS,
            liveness_status=liveness_status,
            liveness_timestamp=liveness_timestamp,
            plausibility_reason=plausibility_reason,
            **common,
        )
    if liveness_status == LivenessStatus.ALIVE:
        final_status = FreshnessStatus.FRESH
    elif liveness_status == LivenessStatus.OVERDUE:
        final_status = FreshnessStatus.STALE
    else:
        final_status = FreshnessStatus.UNKNOWN
    return FreshnessAssessment(
        freshness=final_status,
        reason=liveness_reason,
        basis=FreshnessBasis.DEVICE_LIVENESS,
        liveness_status=liveness_status,
        liveness_timestamp=liveness_timestamp,
        plausibility_reason=plausibility_reason,
        **common,
    )


@dataclass(frozen=True)
class FallbackPolicy:
    """A data-selection fallback; it has no actuator or policy semantics."""

    action: FallbackAction = FallbackAction.REJECT
    default_value: Any = None
    reason: str = "no_valid_observation"

    def as_dict(self) -> dict[str, Any]:
        return {
            "action": self.action.value,
            "default_value": self.default_value,
            "reason": self.reason,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "FallbackPolicy":
        if not data:
            return cls()
        return cls(
            action=FallbackAction(data.get("action", FallbackAction.REJECT.value)),
            default_value=data.get("default_value"),
            reason=str(data.get("reason", "no_valid_observation")),
        )


@dataclass(frozen=True)
class QualityIssue:
    """One field-scoped, traceable quality cause."""

    code: str
    message: str
    field: str
    source_entity: str | None = None
    since: datetime | None = None
    blocking: bool = False
    consumer_effect: str = "field_quality_only"

    def duration_seconds(self, now: datetime | None = None) -> int | None:
        if self.since is None:
            return None
        reference = now or utc_now()
        return max(0, int((reference - self.since).total_seconds()))

    def as_dict(self, now: datetime | None = None) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "field": self.field,
            "source_entity": self.source_entity,
            "since": self.since.isoformat() if self.since else None,
            "duration_seconds": self.duration_seconds(now),
            "blocking": self.blocking,
            "consumer_effect": self.consumer_effect,
        }


@dataclass(frozen=True)
class FieldQuality:
    """Quality is attached to a field, never used to erase other fields."""

    health: HealthStatus
    freshness: FreshnessStatus
    safety: SafetyStatus
    fallback: FallbackAction
    quality: QualityStatus = QualityStatus.GOOD
    reasons: tuple[QualityIssue, ...] = ()
    last_real_change: datetime | None = None
    freshness_assessment: FreshnessAssessment | None = dataclass_field(
        default=None,
        compare=False,
    )

    @property
    def is_healthy(self) -> bool:
        return self.health == HealthStatus.HEALTHY and self.freshness == FreshnessStatus.FRESH

    def as_dict(self, now: datetime | None = None) -> dict[str, Any]:
        data = {
            "health": self.health.value,
            "freshness": self.freshness.value,
            "safety": self.safety.value,
            "fallback": self.fallback.value,
            "quality": self.quality.value,
            "last_real_change": self.last_real_change.isoformat()
            if self.last_real_change
            else None,
            "reasons": [reason.as_dict(now) for reason in self.reasons],
        }
        if self.freshness_assessment is not None:
            data["freshness_assessment"] = self.freshness_assessment.as_dict(now)
        return data


def assess_field_quality(
    *,
    field: str,
    source_entity: str | None,
    evidence: TemporalEvidence | None,
    has_value: bool,
    required: bool,
    safety_class: SafetyClass,
    fallback: FallbackPolicy,
    ttl_seconds: int,
    now: datetime,
    last_real_change: datetime | None = None,
    freshness_requirement: FreshnessRequirement = FreshnessRequirement.DEVICE_OR_HA_EVENT,
    fallback_active: bool = False,
    physical_state: bool = False,
    freshness_assessment: FreshnessAssessment | None = None,
) -> FieldQuality:
    """Create a field-level assessment with explicit fallback and evidence causes."""

    reasons: list[QualityIssue] = []
    freshness = FreshnessStatus.UNKNOWN
    if freshness_assessment is not None:
        freshness = freshness_assessment.freshness
        freshness_reason = freshness_assessment.reason
        if freshness_reason:
            reasons.append(
                QualityIssue(
                    code=freshness_reason,
                    message=freshness_reason.replace("_", " "),
                    field=field,
                    source_entity=source_entity,
                    since=evidence.received_at if evidence else None,
                    blocking=safety_class != SafetyClass.INFORMATIONAL and not has_value,
                    consumer_effect=(
                        "safety_relevant_field_conservative"
                        if safety_class != SafetyClass.INFORMATIONAL
                        else "field_quality_only"
                    ),
                )
            )
    elif evidence is not None:
        freshness, freshness_reason = evidence.freshness(
            now,
            ttl_seconds,
            freshness_requirement,
        )
        if freshness_reason:
            reasons.append(
                QualityIssue(
                    code=freshness_reason,
                    message=freshness_reason.replace("_", " "),
                    field=field,
                    source_entity=source_entity,
                    since=evidence.received_at,
                    blocking=safety_class != SafetyClass.INFORMATIONAL and not has_value,
                    consumer_effect=(
                        "safety_relevant_field_conservative"
                        if safety_class != SafetyClass.INFORMATIONAL
                        else "field_quality_only"
                    ),
                )
            )

    if fallback.action == FallbackAction.HOLD_LAST and fallback_active and has_value:
        reasons.append(
            QualityIssue(
                code="hold_last_active",
                message="last value is held internally and is not current evidence",
                field=field,
                source_entity=source_entity,
                since=evidence.received_at if evidence else None,
                blocking=False,
                consumer_effect="held_value_requires_quality_check",
            )
        )
        return FieldQuality(
            health=HealthStatus.DEGRADED,
            freshness=freshness,
            safety=(
                SafetyStatus.UNSAFE
                if physical_state
                else SafetyStatus.CONSERVATIVE
            ),
            fallback=fallback.action,
            quality=QualityStatus.DEGRADED,
            reasons=tuple(reasons),
            last_real_change=last_real_change,
            freshness_assessment=freshness_assessment,
        )

    if not has_value:
        if fallback.action == FallbackAction.SAFE_DEFAULT:
            reasons.append(
                QualityIssue(
                    code="fallback_active",
                    message=fallback.reason,
                    field=field,
                    source_entity=source_entity,
                    since=evidence.received_at if evidence else None,
                    blocking=False,
                    consumer_effect=(
                        "safe_default_requires_conservative_consumption"
                        if safety_class != SafetyClass.INFORMATIONAL
                        else "fallback_value_only"
                    ),
                )
            )
            return FieldQuality(
                health=HealthStatus.DEGRADED,
                freshness=freshness,
                safety=(
                    SafetyStatus.UNSAFE
                    if physical_state
                    else SafetyStatus.CONSERVATIVE
                ),
                fallback=fallback.action,
                quality=QualityStatus.DEGRADED,
                reasons=tuple(reasons),
                last_real_change=last_real_change,
                freshness_assessment=freshness_assessment,
            )
        reasons.append(
            QualityIssue(
                code="required_value_missing" if required else "optional_value_missing",
                message="no usable observation is available",
                field=field,
                source_entity=source_entity,
                since=evidence.received_at if evidence else None,
                blocking=required,
                consumer_effect=(
                    "consumer_blocked" if required else "field_unavailable"
                ),
            )
        )
        return FieldQuality(
            health=(
                HealthStatus.BLOCKED
                if required
                else HealthStatus.DEGRADED
                if physical_state
                else HealthStatus.UNKNOWN
            ),
            freshness=freshness,
            safety=(
                SafetyStatus.UNKNOWN
                if physical_state
                else SafetyStatus.BLOCKED
                if safety_class != SafetyClass.INFORMATIONAL and required
                else SafetyStatus.UNKNOWN
            ),
            fallback=fallback.action,
            quality=(
                QualityStatus.UNAVAILABLE
                if required
                else QualityStatus.UNKNOWN
            ),
            reasons=tuple(reasons),
            last_real_change=last_real_change,
            freshness_assessment=freshness_assessment,
        )

    if freshness != FreshnessStatus.FRESH:
        return FieldQuality(
            health=HealthStatus.DEGRADED,
            freshness=freshness,
            safety=(
                SafetyStatus.UNSAFE
                if physical_state
                else SafetyStatus.CONSERVATIVE
                if safety_class != SafetyClass.INFORMATIONAL
                else SafetyStatus.VALID
            ),
            fallback=FallbackAction.NONE,
            quality={
                FreshnessStatus.SUSPECT: QualityStatus.SUSPECT,
                FreshnessStatus.STALE: QualityStatus.STALE,
                FreshnessStatus.RESTORED: QualityStatus.UNKNOWN,
                FreshnessStatus.UNKNOWN: QualityStatus.UNKNOWN,
            }.get(freshness, QualityStatus.DEGRADED),
            reasons=tuple(reasons),
            last_real_change=last_real_change,
            freshness_assessment=freshness_assessment,
        )

    return FieldQuality(
        health=HealthStatus.HEALTHY,
        freshness=FreshnessStatus.FRESH,
        safety=SafetyStatus.VALID,
        fallback=FallbackAction.NONE,
        quality=QualityStatus.GOOD,
        reasons=tuple(reasons),
        last_real_change=last_real_change,
        freshness_assessment=freshness_assessment,
    )


def aggregate_health(qualities: Iterable[FieldQuality], required_fields: Iterable[str]) -> HealthStatus:
    """Aggregate headline health without changing any field's factual value."""

    values = tuple(qualities)
    if any(
        quality.health == HealthStatus.BLOCKED
        for quality in values
    ):
        return HealthStatus.BLOCKED
    if any(quality.health != HealthStatus.HEALTHY for quality in values):
        return HealthStatus.DEGRADED
    return HealthStatus.HEALTHY
