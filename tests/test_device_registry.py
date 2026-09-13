from __future__ import annotations

from types import SimpleNamespace

from custom_components.benni_core_contracts.device_registry import (
    cadence_proposal,
    device_proposal_from_registries,
)


class Registry:
    def __init__(self, entries):
        self.entities = {
            entry.entity_id: entry for entry in entries if hasattr(entry, "entity_id")
        }
        self._entries = {
            getattr(entry, "id", getattr(entry, "entity_id", "")): entry
            for entry in entries
        }

    def async_get(self, key):
        return self._entries.get(key) or self.entities.get(key)


def test_conflicting_labels_have_no_preselection_and_show_both_options():
    proposal = cadence_proposal(
        (
            {"id": "contact", "name": "contact_sensor"},
            {"id": "plug", "name": "plug"},
            {"id": "transport", "name": "zigbee"},
        )
    )

    assert proposal["conflict"] is True
    assert proposal["requires_cadence_selection"] is True
    assert proposal["suggested_source_cadence"] is None
    assert proposal["suggested_provenance"] is None
    assert [item["source_cadence"] for item in proposal["options"]] == [
        "event_based",
        "periodic",
    ]
    assert all(item["label_name"] != "zigbee" for item in proposal["matches"])


def test_same_cadence_uses_priority_only_for_visible_proposal_origin():
    proposal = cadence_proposal(
        (
            {"id": "remote", "name": "remote"},
            {"id": "contact", "name": "contact_sensor"},
        )
    )
    assert proposal["conflict"] is False
    assert proposal["suggested_source_cadence"] == "event_based"
    assert proposal["suggested_provenance"] == {
        "kind": "label",
        "label_id": "contact",
    }
    assert proposal["requires_confirmation"] is True


def test_device_link_and_multiple_timestamp_siblings_require_selection():
    bound = SimpleNamespace(entity_id="binary_sensor.door", device_id="device-1")
    first = SimpleNamespace(
        entity_id="sensor.door_last_seen",
        device_id="device-1",
        device_class="timestamp",
        original_device_class=None,
        disabled_by=None,
    )
    second = SimpleNamespace(
        entity_id="sensor.door_last_seen_backup",
        device_id="device-1",
        device_class=None,
        original_device_class="timestamp",
        disabled_by=None,
    )
    entity_registry = Registry((bound, first, second))
    device_registry = Registry(
        (SimpleNamespace(id="device-1", labels={"contact", "transport"}),)
    )
    label_registry = Registry(
        (
            SimpleNamespace(id="contact", name="contact_sensor"),
            SimpleNamespace(id="transport", name="zigbee"),
        )
    )

    proposal = device_proposal_from_registries(
        "binary_sensor.door", entity_registry, device_registry, label_registry
    )

    assert proposal["device_id"] == "device-1"
    assert proposal["cadence"]["suggested_source_cadence"] == "event_based"
    assert proposal["requires_liveness_selection"] is True
    assert proposal["suggested_liveness_entity"] is None
    assert [item["entity_id"] for item in proposal["liveness_candidates"]] == [
        "sensor.door_last_seen",
        "sensor.door_last_seen_backup",
    ]


def test_entity_name_never_implies_cadence_without_device_labels():
    entity = SimpleNamespace(
        entity_id="sensor.hall_entry_door_device_temperature", device_id=None
    )
    proposal = device_proposal_from_registries(
        entity.entity_id, Registry((entity,)), Registry(()), Registry(())
    )
    assert proposal["device_link_found"] is False
    assert proposal["cadence"]["suggested_source_cadence"] is None

