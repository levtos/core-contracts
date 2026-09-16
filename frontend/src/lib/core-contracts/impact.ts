import type { DraftChange } from './draft-diff';
import type { Fusion } from './types';
import type { RequirementUsage } from './registry.svelte';
import { contractsForBinding } from './listing';

/**
 * Which contracts, fields and consumers a set of draft changes touches.
 * Derived from the fusion graph and declared requirements in the existing
 * registry view; no backend call.
 */
export interface DraftImpact {
  contracts: string[];
  fields: string[];
  consumers: string[];
  devices: string[];
}

export function draftImpact(changes: DraftChange[], fusions: Fusion[], requirements: RequirementUsage[], bindings: { binding_id: string; device_id?: string }[]): DraftImpact {
  const contracts = new Set<string>(), fields = new Set<string>(), consumers = new Set<string>(), devices = new Set<string>();
  const touchBinding = (bindingId: string) => {
    for (const target of contractsForBinding(bindingId, fusions)) { contracts.add(target.contractId); fields.add(`${target.contractId}.${target.field}`); fusions.filter((fusion) => fusion.fusion_id === target.fusionId).flatMap((fusion) => fusion.consumer_ids).forEach((id) => consumers.add(id)); }
  };
  for (const change of changes) {
    if (change.kind === 'binding') touchBinding(change.objectId);
    if (change.kind === 'fusion') {
      const fusion = fusions.find((item) => item.fusion_id === change.objectId) ?? (change.after as Fusion | undefined) ?? (change.before as Fusion | undefined);
      if (fusion) { contracts.add(fusion.contract_id); fields.add(`${fusion.contract_id}.${fusion.field}`); fusion.consumer_ids.forEach((id) => consumers.add(id)); }
    }
    if (change.kind === 'contract') contracts.add(change.objectId);
    if (change.kind === 'device') { devices.add(change.objectId); bindings.filter((binding) => binding.device_id === change.objectId).forEach((binding) => touchBinding(binding.binding_id)); }
  }
  for (const requirement of requirements) if (requirement.contract_id && contracts.has(requirement.contract_id)) consumers.add(requirement.consumer_id);
  return { contracts: [...contracts].sort(), fields: [...fields].sort(), consumers: [...consumers].sort(), devices: [...devices].sort() };
}

export const CHANGE_KIND_LABELS: Record<DraftChange['kind'], string> = { binding: 'Quelle', fusion: 'Zusammenführung', contract: 'Vertrag', device: 'Gerät', metadata: 'Metadaten' };
export const CHANGE_ACTION_LABELS: Record<DraftChange['action'], string> = { added: 'hinzugefügt', changed: 'geändert', removed: 'entfernt' };
export const FIELD_LABELS: Record<string, string> = {
  Objekt: 'Eintrag', display_name: 'Anzeigename', entity_id: 'Home-Assistant-Entity', field: 'Rolle / Feld', capability: 'Capability', required: 'Pflichtquelle', enabled: 'Aktiv', freshness_ttl_seconds: 'Frischegrenze (s)', fallback: 'Fallback', device_id: 'Gerätebezug', device_overrides: 'Überschreibungen', consumer_ids: 'Verbraucher', strategy: 'Strategie', input_binding_ids: 'Quellen-Eingänge', input_fusion_ids: 'Zusammenführungs-Eingänge', contract_id: 'Vertrag', schema_id: 'Schema', schema_version: 'Schema-Version', source_cadence: 'Meldeverhalten', expected_interval_s: 'Meldeintervall (s)', liveness_entity: 'Lebenszeichenquelle', cadence_provenance: 'Herkunft der Kadenz',
};
