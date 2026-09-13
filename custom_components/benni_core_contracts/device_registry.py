"""Read-only HA device metadata proposals for registry editing.

Nothing in this module mutates Home Assistant or a registry draft.  Device
links are facts from HA's entity registry; cadence remains a proposal which a
user must explicitly confirm.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from .models import SourceCadence


CADENCE_LABEL_PRIORITY: tuple[tuple[str, SourceCadence], ...] = (
    ("contact_sensor", SourceCadence.EVENT_BASED),
    ("vibration_sensor", SourceCadence.EVENT_BASED),
    ("remote", SourceCadence.EVENT_BASED),
    ("smoke_detector", SourceCadence.EVENT_BASED),
    ("climate_sensor", SourceCadence.PERIODIC),
    ("light_sensor", SourceCadence.PERIODIC),
    ("energy_meter", SourceCadence.PERIODIC),
    ("plug", SourceCadence.PERIODIC),
    ("light_device", SourceCadence.PERIODIC),
)


def cadence_proposal(labels: Iterable[Mapping[str, str]]) -> dict[str, Any]:
    """Build a confirmation-required proposal without resolving conflicts."""

    by_name = {str(item["name"]): str(item["id"]) for item in labels}
    matches = [
        {
            "label_id": by_name[name],
            "label_name": name,
            "source_cadence": cadence.value,
            "origin": f"aus Label {name}",
        }
        for name, cadence in CADENCE_LABEL_PRIORITY
        if name in by_name
    ]
    cadences = {item["source_cadence"] for item in matches}
    conflict = len(cadences) > 1
    selected = matches[0] if len(cadences) == 1 and matches else None
    options = []
    for cadence in (SourceCadence.EVENT_BASED, SourceCadence.PERIODIC):
        evidence = [item for item in matches if item["source_cadence"] == cadence.value]
        if evidence:
            options.append({"source_cadence": cadence.value, "evidence": evidence})
    return {
        "matches": matches,
        "options": options,
        "conflict": conflict,
        "suggested_source_cadence": (
            selected["source_cadence"] if selected is not None else None
        ),
        "suggested_provenance": (
            {"kind": "label", "label_id": selected["label_id"]}
            if selected is not None
            else None
        ),
        "requires_confirmation": bool(matches),
        "requires_cadence_selection": conflict,
    }


def _label_records(device: Any, label_registry: Any) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for label_id in sorted(getattr(device, "labels", ()) or ()):
        entry = label_registry.async_get(label_id)
        if entry is not None:
            records.append({"id": str(label_id), "name": str(entry.name)})
    return records


def _liveness_candidates(entity_registry: Any, device_id: str) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    entries = getattr(entity_registry, "entities", {})
    for entry in entries.values():
        if getattr(entry, "device_id", None) != device_id:
            continue
        device_class = (
            getattr(entry, "device_class", None)
            or getattr(entry, "original_device_class", None)
        )
        if str(getattr(device_class, "value", device_class)) != "timestamp":
            continue
        candidates.append(
            {
                "entity_id": str(entry.entity_id),
                "disabled": getattr(entry, "disabled_by", None) is not None,
                "origin": "Geschwister-Entity mit device_class timestamp",
            }
        )
    return sorted(candidates, key=lambda item: item["entity_id"])


def device_proposal_from_registries(
    entity_id: str,
    entity_registry: Any,
    device_registry: Any,
    label_registry: Any,
) -> dict[str, Any]:
    """Describe the HA device and proposals for one bound entity."""

    entity = entity_registry.async_get(entity_id)
    device_id = getattr(entity, "device_id", None) if entity is not None else None
    if not device_id:
        return {
            "entity_id": entity_id,
            "device_id": None,
            "device_link_found": False,
            "cadence": cadence_proposal(()),
            "liveness_candidates": [],
            "suggested_liveness_entity": None,
            "requires_liveness_selection": False,
        }
    device = device_registry.async_get(device_id)
    labels = _label_records(device, label_registry) if device is not None else []
    candidates = _liveness_candidates(entity_registry, str(device_id))
    usable = [item for item in candidates if not item["disabled"]]
    return {
        "entity_id": entity_id,
        "device_id": str(device_id),
        "device_link_found": True,
        "cadence": cadence_proposal(labels),
        "liveness_candidates": candidates,
        "suggested_liveness_entity": (
            usable[0]["entity_id"] if len(usable) == 1 else None
        ),
        "requires_liveness_selection": len(usable) > 1,
    }


def device_proposal(hass: Any, entity_id: str) -> dict[str, Any]:
    """Resolve a proposal from the three authoritative HA registries."""

    from homeassistant.helpers import device_registry as dr
    from homeassistant.helpers import entity_registry as er
    from homeassistant.helpers import label_registry as lr

    return device_proposal_from_registries(
        entity_id,
        er.async_get(hass),
        dr.async_get(hass),
        lr.async_get(hass),
    )
