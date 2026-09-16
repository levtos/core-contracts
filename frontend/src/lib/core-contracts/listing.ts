import type {
  AtomicSignal,
  Contract,
  DiagnosticField,
  DiagnosticProjection,
  FreshnessAssessment,
  Fusion,
  HassLike,
  HealthStatus,
  SourceCadence,
} from './types';
import type { Device, EditableBinding, RequirementUsage } from './registry.svelte';
import { entityDomain, type ConfigState } from './labels';

/** Pure list models for the table views. No persistence, no writes. */

export type StatusFilter = 'all' | HealthStatus | 'not_configured';
export type SortDirection = 'asc' | 'desc';

export interface ListFilter {
  query: string;
  status: StatusFilter;
  domain: string;
  cadence: 'all' | SourceCadence;
  deviceType: string;
  sort: string;
  direction: SortDirection;
}

export const DEFAULT_FILTER: ListFilter = { query: '', status: 'all', domain: 'all', cadence: 'all', deviceType: 'all', sort: 'name', direction: 'asc' };

export function filterFromQuery(query: URLSearchParams | Record<string, string>, sort = 'name'): ListFilter {
  const get = (key: string) => (query instanceof URLSearchParams ? query.get(key) : query[key]) ?? '';
  return {
    query: get('q'),
    status: (get('status') || 'all') as StatusFilter,
    domain: get('domain') || 'all',
    cadence: (get('cadence') || 'all') as ListFilter['cadence'],
    deviceType: get('type') || 'all',
    sort: get('sort') || sort,
    direction: get('dir') === 'desc' ? 'desc' : 'asc',
  };
}

export function filterToQuery(filter: ListFilter, defaultSort = 'name'): Record<string, string> {
  const out: Record<string, string> = {};
  if (filter.query) out.q = filter.query;
  if (filter.status !== 'all') out.status = filter.status;
  if (filter.domain !== 'all') out.domain = filter.domain;
  if (filter.cadence !== 'all') out.cadence = filter.cadence;
  if (filter.deviceType !== 'all') out.type = filter.deviceType;
  if (filter.sort !== defaultSort) out.sort = filter.sort;
  if (filter.direction !== 'asc') out.dir = filter.direction;
  return out;
}

export interface DeviceInfo { id: string; name: string; model: string | null; manufacturer: string | null; labels: string[] }

export function describeDevice(hass: HassLike | null | undefined, deviceId: string | null | undefined): DeviceInfo | null {
  if (!deviceId) return null;
  const entry = hass?.devices?.[deviceId];
  if (!entry) return { id: deviceId, name: deviceId, model: null, manufacturer: null, labels: [] };
  return {
    id: deviceId,
    name: entry.name_by_user || entry.name || deviceId,
    model: entry.model ?? null,
    manufacturer: entry.manufacturer ?? null,
    labels: entry.labels ?? [],
  };
}

export interface EffectiveCadence {
  cadence: SourceCadence;
  source: 'binding_override' | 'device' | 'legacy_unknown';
  expectedInterval: number | null;
  livenessEntity: string | null;
}

export function effectiveCadence(binding: EditableBinding, devices: Device[]): EffectiveCadence {
  const device = devices.find((item) => item.device_id === binding.device_id) ?? null;
  const overrides = binding.device_overrides ?? {};
  const cadence = overrides.source_cadence ?? device?.source_cadence ?? 'unknown';
  const source: EffectiveCadence['source'] = overrides.source_cadence !== undefined ? 'binding_override' : device ? 'device' : 'legacy_unknown';
  const expectedInterval = 'expected_interval_s' in overrides ? (overrides.expected_interval_s ?? null) : device?.expected_interval_s ?? null;
  const livenessEntity = 'liveness_entity' in overrides ? (overrides.liveness_entity ?? null) : device?.liveness_entity ?? null;
  return { cadence, source, expectedInterval, livenessEntity };
}

export interface SourceRow {
  id: string;
  binding: EditableBinding;
  name: string;
  entityId: string;
  entityName: string;
  domain: string;
  role: string;
  capability: string;
  device: DeviceInfo | null;
  deviceType: string;
  cadence: EffectiveCadence;
  freshness: string;
  freshnessAssessment: FreshnessAssessment | null;
  health: HealthStatus;
  configState: ConfigState;
  entityExists: boolean | null;
  consumers: string[];
  contracts: string[];
  reasons: string[];
}

export interface RowContext {
  bindings: EditableBinding[];
  fusions: Fusion[];
  devices: Device[];
  diagnostics: DiagnosticProjection[];
  signals: AtomicSignal[];
  requirements: RequirementUsage[];
  hass: HassLike | null;
}

/** Which contract fields consume a binding, following fusion chains. */
export function contractsForBinding(bindingId: string, fusions: Fusion[]): { contractId: string; field: string; fusionId: string }[] {
  const result = new Map<string, { contractId: string; field: string; fusionId: string }>();
  const affected = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const fusion of fusions) {
      if (affected.has(fusion.fusion_id)) continue;
      if (fusion.input_binding_ids.includes(bindingId) || fusion.input_fusion_ids.some((id) => affected.has(id))) {
        affected.add(fusion.fusion_id);
        result.set(fusion.fusion_id, { contractId: fusion.contract_id, field: fusion.field, fusionId: fusion.fusion_id });
        changed = true;
      }
    }
  }
  return [...result.values()];
}

export function consumersForBinding(binding: EditableBinding, fusions: Fusion[], requirements: RequirementUsage[]): string[] {
  const contracts = new Set(contractsForBinding(binding.binding_id, fusions).map((item) => item.contractId));
  const fromFusions = fusions.filter((fusion) => contractsForBinding(binding.binding_id, fusions).some((item) => item.fusionId === fusion.fusion_id)).flatMap((fusion) => fusion.consumer_ids);
  const declared = requirements
    .filter((item) => item.role === binding.field || item.role === binding.binding_id || item.role === binding.capability || item.role === binding.source_id || (item.contract_id && contracts.has(item.contract_id)))
    .map((item) => item.consumer_id);
  return [...new Set([...binding.consumer_ids, ...fromFusions, ...declared])];
}

function diagnosticFieldsForBinding(bindingId: string, fusions: Fusion[], diagnostics: DiagnosticProjection[]): DiagnosticField[] {
  const direct = diagnostics.flatMap((projection) => projection.fields.filter((field) => field.binding_ids?.includes(bindingId)));
  if (direct.length) return direct;
  const targets = contractsForBinding(bindingId, fusions);
  return diagnostics.flatMap((projection) => projection.fields.filter((field) => targets.some((target) => target.contractId === projection.contract_id && target.field === field.field)));
}

const HEALTH_ORDER: Record<HealthStatus, number> = { healthy: 0, unknown: 1, degraded: 2, blocked: 3 };

export function buildSourceRows(context: RowContext): SourceRow[] {
  return context.bindings.map((binding) => {
    const signal = context.signals.find((item) => item.binding_id === binding.binding_id) ?? null;
    const fields = diagnosticFieldsForBinding(binding.binding_id, context.fusions, context.diagnostics);
    const entityState = context.hass?.states?.[binding.entity_id];
    const entityExists = context.hass?.states ? Boolean(entityState) : null;
    const incomplete = !binding.entity_id || !binding.field || !binding.capability;
    const configState: ConfigState = incomplete ? 'incomplete' : binding.enabled === false ? 'disabled' : !binding.device_id ? 'no_device' : 'configured';
    const health: HealthStatus = signal?.quality.health ?? (fields.length ? fields.map((field) => field.health).sort((a, b) => HEALTH_ORDER[b] - HEALTH_ORDER[a])[0] : 'unknown');
    const freshnessAssessment = signal?.quality.freshness_assessment ?? fields.find((field) => field.freshness_assessment)?.freshness_assessment ?? null;
    const freshness = signal?.quality.freshness ?? freshnessAssessment?.status ?? fields[0]?.freshness ?? 'unknown';
    const reasons = [...new Set([...(signal?.quality.reasons ?? []).map((item) => item.code), ...fields.flatMap((field) => field.root_causes.filter((cause) => !cause.source_entity || cause.source_entity === binding.entity_id).map((cause) => cause.code))])];
    const device = describeDevice(context.hass, binding.device_id);
    const targets = contractsForBinding(binding.binding_id, context.fusions);
    return {
      id: binding.binding_id,
      binding,
      name: binding.display_name?.trim() || entityState?.attributes.friendly_name || binding.entity_id || binding.binding_id,
      entityId: binding.entity_id,
      entityName: entityState?.attributes.friendly_name ?? '',
      domain: entityDomain(binding.entity_id),
      role: binding.field,
      capability: binding.capability,
      device,
      deviceType: device?.labels[0] ?? device?.model ?? (device ? 'gerät' : ''),
      cadence: effectiveCadence(binding, context.devices),
      freshness,
      freshnessAssessment,
      health,
      configState,
      entityExists,
      consumers: consumersForBinding(binding, context.fusions, context.requirements),
      contracts: [...new Set(targets.map((item) => item.contractId))],
      reasons,
    };
  });
}

export interface FusionRow {
  id: string;
  fusion: Fusion;
  name: string;
  contractId: string;
  field: string;
  strategy: string;
  inputs: { id: string; kind: 'binding' | 'fusion'; label: string; missing: boolean; required: boolean; active: boolean }[];
  missingInputs: number;
  health: HealthStatus;
  consumers: string[];
}

export function buildFusionRows(context: RowContext, contracts: Contract[]): FusionRow[] {
  return context.fusions.map((fusion) => {
    const contract = contracts.find((item) => item.contract_id === fusion.contract_id);
    const evaluation = contract?.field_evaluations[fusion.field];
    const diagnostic = context.diagnostics.find((item) => item.contract_id === fusion.contract_id)?.fields.find((item) => item.field === fusion.field);
    const inputs = [
      ...fusion.input_binding_ids.map((id) => {
        const binding = context.bindings.find((item) => item.binding_id === id);
        return { id, kind: 'binding' as const, label: binding?.display_name?.trim() || binding?.entity_id || id, missing: !binding, required: binding?.required ?? false, active: evaluation?.active_binding_ids.includes(id) ?? false };
      }),
      ...fusion.input_fusion_ids.map((id) => {
        const child = context.fusions.find((item) => item.fusion_id === id);
        return { id, kind: 'fusion' as const, label: child ? `${child.contract_id}.${child.field}` : id, missing: !child, required: false, active: false };
      }),
    ];
    return {
      id: fusion.fusion_id,
      fusion,
      name: `${fusion.contract_id} · ${fusion.field}`,
      contractId: fusion.contract_id,
      field: fusion.field,
      strategy: fusion.strategy,
      inputs,
      missingInputs: inputs.filter((item) => item.missing).length,
      health: diagnostic?.health ?? contract?.field_quality[fusion.field]?.health ?? 'unknown',
      consumers: [...new Set([...fusion.consumer_ids, ...context.requirements.filter((item) => item.contract_id === fusion.contract_id).map((item) => item.consumer_id)])],
    };
  });
}

export interface DeviceRow {
  id: string;
  device: Device;
  info: DeviceInfo;
  cadence: SourceCadence;
  provenance: string;
  expectedInterval: number | null;
  livenessEntity: string | null;
  livenessState: string | null;
  livenessStatus: string;
  sources: SourceRow[];
  health: HealthStatus;
  deviceType: string;
}

export function buildDeviceRows(context: RowContext, sourceRows: SourceRow[]): DeviceRow[] {
  return context.devices.map((device) => {
    const info = describeDevice(context.hass, device.device_id) ?? { id: device.device_id, name: device.device_id, model: null, manufacturer: null, labels: [] };
    const sources = sourceRows.filter((row) => row.binding.device_id === device.device_id);
    const assessment = sources.map((row) => row.freshnessAssessment).find((item) => item?.liveness_configured) ?? null;
    const livenessState = device.liveness_entity ? (context.hass?.states?.[device.liveness_entity]?.state ?? null) : null;
    const livenessStatus = assessment?.liveness_status ?? (device.liveness_entity ? 'unknown' : 'not_applicable');
    const health: HealthStatus = sources.length ? sources.map((row) => row.health).sort((a, b) => HEALTH_ORDER[b] - HEALTH_ORDER[a])[0] : 'unknown';
    return {
      id: device.device_id,
      device,
      info,
      cadence: device.source_cadence,
      provenance: device.cadence_provenance.kind === 'label' ? `Label ${device.cadence_provenance.label_id ?? ''}`.trim() : 'Manuell bestätigt',
      expectedInterval: device.expected_interval_s ?? null,
      livenessEntity: device.liveness_entity ?? null,
      livenessState,
      livenessStatus,
      sources,
      health,
      deviceType: info.labels[0] ?? info.model ?? '',
    };
  });
}

export interface ContractRow {
  id: string;
  contract: Contract;
  name: string;
  schema: string;
  domain: string;
  health: HealthStatus;
  freshness: string;
  unknownFields: number;
  fields: number;
  consumers: string[];
  sourceCount: number;
}

export function buildContractRows(contracts: Contract[], context: RowContext): ContractRow[] {
  return contracts.map((contract) => {
    const fusions = context.fusions.filter((item) => item.contract_id === contract.contract_id);
    const bindingIds = new Set(fusions.flatMap((item) => item.input_binding_ids));
    const domains = [...new Set([...bindingIds].map((id) => entityDomain(context.bindings.find((item) => item.binding_id === id)?.entity_id)).filter(Boolean))];
    const qualities = Object.values(contract.field_quality);
    const freshness = qualities.some((item) => item.freshness === 'stale') ? 'stale' : qualities.some((item) => item.freshness === 'suspect') ? 'suspect' : qualities.length && qualities.every((item) => item.freshness === 'fresh') ? 'fresh' : 'unknown';
    return {
      id: contract.contract_id,
      contract,
      name: contract.contract_id,
      schema: contract.schema_id,
      domain: domains.join(','),
      health: contract.health,
      freshness,
      unknownFields: Object.values(contract.field_states).filter((state) => state === 'unknown').length,
      fields: Object.keys(contract.values).length,
      consumers: [...new Set([...fusions.flatMap((item) => item.consumer_ids), ...context.requirements.filter((item) => item.contract_id === contract.contract_id).map((item) => item.consumer_id)])],
      sourceCount: bindingIds.size,
    };
  });
}

interface Searchable { health: HealthStatus }

function matchesStatus(row: Searchable & { configState?: ConfigState }, status: StatusFilter): boolean {
  if (status === 'all') return true;
  if (status === 'not_configured') return row.configState === 'incomplete' || row.configState === 'no_device' || row.configState === 'disabled';
  return row.health === status;
}

export function applyFilter<T extends Searchable & { configState?: ConfigState; domain?: string; deviceType?: string; cadence?: EffectiveCadence | SourceCadence }>(rows: T[], filter: ListFilter, text: (row: T) => string): T[] {
  const query = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (query && !text(row).toLowerCase().includes(query)) return false;
    if (!matchesStatus(row, filter.status)) return false;
    if (filter.domain !== 'all' && !(row.domain ?? '').split(',').includes(filter.domain)) return false;
    if (filter.deviceType !== 'all' && (row.deviceType ?? '') !== filter.deviceType) return false;
    if (filter.cadence !== 'all') {
      const cadence = typeof row.cadence === 'string' ? row.cadence : row.cadence?.cadence;
      if (cadence !== filter.cadence) return false;
    }
    return true;
  });
}

export function sortRows<T>(rows: T[], filter: ListFilter, keys: Record<string, (row: T) => string | number>): T[] {
  const key = keys[filter.sort] ?? keys[Object.keys(keys)[0]];
  const direction = filter.direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = key(a), right = key(b);
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
    return String(left).localeCompare(String(right), 'de') * direction;
  });
}

export const healthRank = (health: HealthStatus): number => HEALTH_ORDER[health] ?? 1;

export function countByHealth(rows: { health: HealthStatus }[]): Record<HealthStatus, number> {
  const counts: Record<HealthStatus, number> = { healthy: 0, degraded: 0, blocked: 0, unknown: 0 };
  for (const row of rows) counts[row.health] = (counts[row.health] ?? 0) + 1;
  return counts;
}

export function distinct(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'de'));
}
