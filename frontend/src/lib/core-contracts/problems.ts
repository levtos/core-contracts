import type { Contract, DiagnosticProjection, HealthStatus } from './types';
import type { Validation } from './registry.svelte';
import { REQUIREMENT_STATUS_LABELS, labelForReason } from './labels';
import { contractsForBinding, type DeviceRow, type RowContext, type SourceRow } from './listing';

/**
 * Current problems, derived purely from data the existing API already
 * delivers: diagnostics, registry view, graph signals, validation results
 * and the Home Assistant state registry. No new backend call.
 */
export type ProblemKind =
  | 'field_missing_required_source'
  | 'source_unhealthy'
  | 'device_without_liveness'
  | 'device_liveness_overdue'
  | 'role_unbound'
  | 'entity_missing'
  | 'type_conflict'
  | 'cycle'
  | 'source_incomplete'
  | 'source_without_device'
  | 'api_reported';

export type ProblemAction =
  | { kind: 'edit_binding'; bindingId: string }
  | { kind: 'edit_device'; deviceId: string }
  | { kind: 'edit_fusion'; fusionId: string }
  | { kind: 'trace'; contractId: string; field: string }
  | { kind: 'contract'; contractId: string }
  | { kind: 'changes' }
  | { kind: 'sources' };

export interface Problem {
  id: string;
  kind: ProblemKind;
  status: HealthStatus | 'not_configured';
  title: string;
  reason: string;
  entity: string;
  entityKind: 'Vertragsfeld' | 'Quelle' | 'Gerät' | 'Verbraucher' | 'Zusammenführung' | 'Entwurf';
  actionLabel: string;
  action: ProblemAction;
  technical?: string;
}

export const PROBLEM_GROUPS: Record<ProblemKind, string> = {
  field_missing_required_source: 'Vertragsfelder ohne verwendbare Pflichtquelle',
  source_unhealthy: 'Eingeschränkte oder blockierte Quellen',
  device_without_liveness: 'Geräte ohne Lebenszeichenquelle',
  device_liveness_overdue: 'Geräte ohne nachgewiesenes Lebenszeichen',
  role_unbound: 'Nicht gebundene Pflichtrollen',
  entity_missing: 'Nicht mehr existierende Entity-Referenzen',
  type_conflict: 'Typkonflikte',
  cycle: 'Zyklische Abhängigkeiten',
  source_incomplete: 'Unvollständige Quellenzuordnungen',
  source_without_device: 'Quellen ohne Gerätebezug (Legacy)',
  api_reported: 'Weitere von der API gemeldete Probleme',
};

export interface ProblemInput {
  context: RowContext;
  sourceRows: SourceRow[];
  deviceRows: DeviceRow[];
  contracts: Contract[];
  diagnostics: DiagnosticProjection[];
  validation: Validation | null;
}

const COVERED_REASONS = new Set(['required_value_missing', 'source_unavailable', 'device_timestamp_required', 'liveness_entity_not_configured', 'source_liveness_overdue', 'source_liveness_unknown']);

export function collectProblems(input: ProblemInput): Problem[] {
  const { context, sourceRows, deviceRows, diagnostics, validation } = input;
  const problems: Problem[] = [];
  const states = context.hass?.states;

  for (const row of sourceRows) {
    if (row.configState === 'incomplete') problems.push({ id: `incomplete:${row.id}`, kind: 'source_incomplete', status: 'not_configured', title: row.name, reason: 'Entity, Rolle oder Capability der Quelle fehlen.', entity: row.entityId || row.binding.binding_id, entityKind: 'Quelle', actionLabel: 'Quelle einrichten', action: { kind: 'edit_binding', bindingId: row.id } });
    if (states && row.entityId && !states[row.entityId]) problems.push({ id: `entity:${row.id}`, kind: 'entity_missing', status: 'blocked', title: row.name, reason: `Die Entity ${row.entityId} existiert aktuell nicht in Home Assistant.`, entity: row.entityId, entityKind: 'Quelle', actionLabel: 'Entity ersetzen', action: { kind: 'edit_binding', bindingId: row.id } });
    if ((row.health === 'degraded' || row.health === 'blocked') && row.binding.enabled !== false) problems.push({ id: `health:${row.id}`, kind: 'source_unhealthy', status: row.health, title: row.name, reason: row.reasons.length ? row.reasons.map((code) => labelForReason(code)).join(' ') : row.health === 'blocked' ? 'Die Quelle liefert keinen verwendbaren Wert.' : 'Die Quelle liefert nur eingeschränkt verwendbare Werte.', entity: row.entityId, entityKind: 'Quelle', actionLabel: 'Quelle bearbeiten', action: { kind: 'edit_binding', bindingId: row.id }, technical: row.reasons.join(', ') || undefined });
    if (row.configState === 'no_device' && row.binding.enabled !== false) problems.push({ id: `nodevice:${row.id}`, kind: 'source_without_device', status: 'not_configured', title: row.name, reason: 'Kein Gerätebezug: Meldeverhalten und Lebenszeichen können nicht bewertet werden (Legacy-Verhalten).', entity: row.entityId, entityKind: 'Quelle', actionLabel: 'Gerät zuordnen', action: { kind: 'edit_binding', bindingId: row.id } });
  }

  for (const row of deviceRows) {
    if (!row.livenessEntity) problems.push({ id: `liveness:${row.id}`, kind: 'device_without_liveness', status: 'not_configured', title: row.info.name, reason: 'Für dieses Gerät ist keine Lebenszeichenquelle festgelegt; ereignisbasierte Werte können nicht als lebendig bestätigt werden.', entity: row.id, entityKind: 'Gerät', actionLabel: 'Lebenszeichen festlegen', action: { kind: 'edit_device', deviceId: row.id } });
    else if (row.livenessStatus === 'overdue' || row.livenessStatus === 'unknown' || (states && !states[row.livenessEntity])) problems.push({ id: `overdue:${row.id}`, kind: 'device_liveness_overdue', status: row.livenessStatus === 'overdue' ? 'degraded' : 'unknown', title: row.info.name, reason: states && !states[row.livenessEntity] ? `Die Lebenszeichenquelle ${row.livenessEntity} existiert nicht in Home Assistant.` : row.livenessStatus === 'overdue' ? 'Das Gerät hat sich länger als das erwartete Intervall nicht gemeldet.' : 'Das Lebenszeichen konnte nicht bewertet werden.', entity: row.livenessEntity, entityKind: 'Gerät', actionLabel: 'Gerät prüfen', action: { kind: 'edit_device', deviceId: row.id } });
  }

  for (const projection of diagnostics) {
    for (const field of projection.fields) {
      const fusion = context.fusions.find((item) => item.contract_id === projection.contract_id && item.field === field.field);
      const requiredMissing = field.root_causes.some((cause) => cause.code === 'required_value_missing' || cause.code === 'opening_source_missing') || (!field.completeness && (field.health === 'blocked' || !field.source_entities.length));
      if (requiredMissing) problems.push({ id: `field:${projection.contract_id}:${field.field}`, kind: 'field_missing_required_source', status: field.health === 'unknown' ? 'blocked' : field.health, title: `${projection.contract_id} · ${field.field}`, reason: field.root_causes[0] ? labelForReason(field.root_causes[0].code, field.root_causes[0].message) : field.source_entities.length ? 'Keine der konfigurierten Quellen liefert einen verwendbaren Wert.' : 'Für dieses Feld ist keine Quelle konfiguriert.', entity: fusion ? `${fusion.contract_id}.${fusion.field}` : projection.contract_id, entityKind: 'Vertragsfeld', actionLabel: field.source_entities.length ? 'Warum?' : fusion ? 'Zusammenführung bearbeiten' : 'Vertrag öffnen', action: field.source_entities.length ? { kind: 'trace', contractId: projection.contract_id, field: field.field } : fusion ? { kind: 'edit_fusion', fusionId: fusion.fusion_id } : { kind: 'contract', contractId: projection.contract_id }, technical: field.root_causes.map((cause) => cause.code).join(', ') || undefined });
      for (const cause of field.root_causes) {
        if (COVERED_REASONS.has(cause.code) || requiredMissing) continue;
        if (/type|schema/i.test(cause.code)) problems.push({ id: `type:${projection.contract_id}:${field.field}:${cause.code}`, kind: 'type_conflict', status: field.health, title: `${projection.contract_id} · ${field.field}`, reason: labelForReason(cause.code, cause.message), entity: cause.source_entity ?? projection.contract_id, entityKind: 'Vertragsfeld', actionLabel: 'Warum?', action: { kind: 'trace', contractId: projection.contract_id, field: field.field }, technical: cause.code });
        else problems.push({ id: `api:${projection.contract_id}:${field.field}:${cause.code}`, kind: 'api_reported', status: field.health, title: `${projection.contract_id} · ${field.field}`, reason: labelForReason(cause.code, cause.message), entity: cause.source_entity ?? projection.contract_id, entityKind: 'Vertragsfeld', actionLabel: 'Warum?', action: { kind: 'trace', contractId: projection.contract_id, field: field.field }, technical: cause.code });
      }
    }
  }

  for (const requirement of context.requirements) {
    if (requirement.status === 'healthy') continue;
    const typeConflict = requirement.status === 'schema_mismatch' || requirement.status === 'version_incompatible';
    const unbound = requirement.status === 'missing' || requirement.status === 'field_missing' || requirement.status === 'binding_ambiguous' || requirement.status === 'consumer_not_registered';
    if (!typeConflict && !unbound) continue;
    const roleBinding = context.bindings.find((binding) => binding.field === requirement.role || binding.capability === requirement.role || binding.binding_id === requirement.role);
    problems.push({ id: `req:${requirement.consumer_id}:${requirement.contract_id ?? ''}:${requirement.role ?? ''}`, kind: typeConflict ? 'type_conflict' : 'role_unbound', status: 'blocked', title: `${requirement.consumer_id} · ${requirement.role ?? requirement.contract_id ?? 'Anforderung'}`, reason: `${REQUIREMENT_STATUS_LABELS[requirement.status] ?? requirement.status}: der Verbraucher ${requirement.consumer_id} erhält keinen verwendbaren Wert.`, entity: requirement.contract_id ?? requirement.role ?? requirement.consumer_id, entityKind: 'Verbraucher', actionLabel: roleBinding ? 'Quelle bearbeiten' : requirement.contract_id ? 'Vertrag öffnen' : 'Quelle anlegen', action: roleBinding ? { kind: 'edit_binding', bindingId: roleBinding.binding_id } : requirement.contract_id ? { kind: 'contract', contractId: requirement.contract_id } : { kind: 'sources' }, technical: requirement.status });
  }

  for (const [index, error] of (validation?.errors ?? []).entries()) {
    const message = `${error.message} ${error.path ?? ''}`;
    if (/cycle|zykl/i.test(message)) problems.push({ id: `cycle:${index}`, kind: 'cycle', status: 'blocked', title: 'Zusammenführungen bilden einen Kreis', reason: error.message, entity: error.path ?? 'Entwurf', entityKind: 'Zusammenführung', actionLabel: 'Entwurf prüfen', action: { kind: 'changes' }, technical: error.code });
    else if (/type|typ|schema|value_type/i.test(message)) problems.push({ id: `vtype:${index}`, kind: 'type_conflict', status: 'blocked', title: 'Typkonflikt im Entwurf', reason: error.message, entity: error.path ?? 'Entwurf', entityKind: 'Entwurf', actionLabel: 'Entwurf prüfen', action: { kind: 'changes' }, technical: error.code });
    else problems.push({ id: `verr:${index}`, kind: 'api_reported', status: 'blocked', title: 'Prüfung meldet einen Fehler', reason: error.message, entity: error.path ?? 'Entwurf', entityKind: 'Entwurf', actionLabel: 'Entwurf öffnen', action: { kind: 'changes' }, technical: error.code });
  }

  const cycle = detectCycle(context.fusions);
  if (cycle) problems.push({ id: `cycle:${cycle}`, kind: 'cycle', status: 'blocked', title: 'Zusammenführungen bilden einen Kreis', reason: `Die Zusammenführung ${cycle} führt über ihre Eingänge zu sich selbst zurück.`, entity: cycle, entityKind: 'Zusammenführung', actionLabel: 'Zusammenführung bearbeiten', action: { kind: 'edit_fusion', fusionId: cycle } });

  return dedupe(problems);
}

function detectCycle(fusions: RowContext['fusions']): string | null {
  const byId = new Map(fusions.map((fusion) => [fusion.fusion_id, fusion]));
  const visiting = new Set<string>(), done = new Set<string>();
  const visit = (id: string): string | null => {
    if (done.has(id)) return null;
    if (visiting.has(id)) return id;
    visiting.add(id);
    for (const child of byId.get(id)?.input_fusion_ids ?? []) { const found = visit(child); if (found) return found; }
    visiting.delete(id); done.add(id);
    return null;
  };
  for (const fusion of fusions) { const found = visit(fusion.fusion_id); if (found) return found; }
  return null;
}

function dedupe(problems: Problem[]): Problem[] {
  const seen = new Set<string>();
  return problems.filter((problem) => { if (seen.has(problem.id)) return false; seen.add(problem.id); return true; });
}

export function groupProblems(problems: Problem[]): { kind: ProblemKind; label: string; items: Problem[] }[] {
  return (Object.keys(PROBLEM_GROUPS) as ProblemKind[]).map((kind) => ({ kind, label: PROBLEM_GROUPS[kind], items: problems.filter((problem) => problem.kind === kind) })).filter((group) => group.items.length);
}

/** Contracts that appear in several quality categories are explained, not double counted. */
export function contractCategories(contracts: Contract[]): { unknown: string[]; degraded: string[]; blocked: string[]; overlap: string[] } {
  const unknown = contracts.filter((item) => Object.values(item.field_states).some((state) => state === 'unknown')).map((item) => item.contract_id);
  const degraded = contracts.filter((item) => item.health === 'degraded').map((item) => item.contract_id);
  const blocked = contracts.filter((item) => item.health === 'blocked').map((item) => item.contract_id);
  const overlap = unknown.filter((id) => degraded.includes(id) || blocked.includes(id));
  return { unknown, degraded, blocked, overlap };
}

export { contractsForBinding };
