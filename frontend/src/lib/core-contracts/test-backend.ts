import type { Contract, DiagnosticProjection, FieldQuality, GraphSnapshot, HassLike, HealthItem, HealthStatus, SourceBinding } from './types';
import { normalizeBinding, type Device, type DeviceProposal, type Draft, type EditableBinding, type Profile, type RegistryPayload, type RegistryView, type Revision } from './registry.svelte';

/**
 * Test double for the existing Home Assistant WebSocket API. It answers the
 * read-only command family and the registry draft family with the same
 * message shapes as the backend and simulates one backend rule so that the
 * device/cadence acceptance path has an observable effect:
 *
 *   A binding is usable only when its effective cadence is known (device
 *   confirmed or binding override). Legacy bindings without device stay
 *   blocked with reason `device_timestamp_required`.
 *
 * This is a simulation of the backend for frontend tests, not a second
 * implementation of the business logic.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const NOW = '2026-09-17T09:00:00.000Z';

export function frontDoorPayload(): RegistryPayload {
  return {
    profile: 'benni', schema_version: 2,
    bindings: [
      { binding_id: 'binding.front-door', source_id: 'source.front-door', entity_id: 'binary_sensor.front_door_contact', field: 'opening_state', capability: 'opening', profile_id: 'benni', required: true, freshness_ttl_seconds: 300, consumer_ids: ['door_policy'], fallback: { action: 'reject', default_value: null, reason: 'no_valid_observation' }, read_only: true, display_name: 'Haustür Kontakt' },
      { binding_id: 'binding.living.temperature', source_id: 'source.living.temperature', entity_id: 'sensor.living_room_multisensor_temperature_measurement_channel_long_id', field: 'temperature', capability: 'room_climate', profile_id: 'benni', required: true, freshness_ttl_seconds: 900, consumer_ids: ['climate_policy'], fallback: { action: 'reject', default_value: null, reason: 'no_valid_observation' }, read_only: true, display_name: 'Wohnzimmer Temperatur', device_id: 'device-living', device_overrides: { source_cadence: 'periodic', expected_interval_s: 600 } },
    ],
    fusions: [
      { fusion_id: 'fusion.front-door', contract_id: 'opening.front_door', field: 'opening_state', input_binding_ids: ['binding.front-door'], input_fusion_ids: [], strategy: 'first_healthy', consumer_ids: ['door_policy'] },
      { fusion_id: 'fusion.living.temperature', contract_id: 'room.living', field: 'temperature', input_binding_ids: ['binding.living.temperature'], input_fusion_ids: [], strategy: 'first_healthy', consumer_ids: ['climate_policy'] },
    ],
    contract_instances: [
      { contract_id: 'opening.front_door', schema_id: 'opening', schema_version: 1, profile: 'benni', display_name: 'Haustür' },
      { contract_id: 'room.living', schema_id: 'room_climate', schema_version: 1, profile: 'benni', display_name: 'Wohnzimmer' },
    ],
    consumer_overrides: {}, registry_metadata: {},
    devices: [{ device_id: 'device-living', source_cadence: 'periodic', expected_interval_s: 600, cadence_provenance: { kind: 'manual' } }],
  };
}

export function fakeHassStates(): NonNullable<HassLike['states']> {
  return {
    'binary_sensor.front_door_contact': { entity_id: 'binary_sensor.front_door_contact', state: 'off', last_changed: NOW, last_updated: NOW, attributes: { friendly_name: 'Haustür Kontakt', device_class: 'door' } },
    'sensor.front_door_last_seen': { entity_id: 'sensor.front_door_last_seen', state: NOW, last_changed: NOW, last_updated: NOW, attributes: { friendly_name: 'Haustür Zuletzt gesehen', device_class: 'timestamp' } },
    'sensor.living_room_multisensor_temperature_measurement_channel_long_id': { entity_id: 'sensor.living_room_multisensor_temperature_measurement_channel_long_id', state: '21.5', last_changed: NOW, last_updated: NOW, attributes: { friendly_name: 'Wohnzimmer Temperatur' } },
    'sensor.spare': { entity_id: 'sensor.spare', state: '1', attributes: { friendly_name: 'Ersatzsensor' } },
  };
}

export function fakeHassDevices(): NonNullable<HassLike['devices']> {
  return {
    'device-front-door': { id: 'device-front-door', name: 'Aqara Türsensor', name_by_user: 'Haustür Sensor', manufacturer: 'Aqara', model: 'MCCGQ11LM', labels: ['contact_sensor'] },
    'device-living': { id: 'device-living', name: 'Multisensor', name_by_user: null, manufacturer: 'Aeotec', model: 'ZW100', labels: ['multisensor'] },
  };
}

function quality(health: HealthStatus, reasons: FieldQuality['reasons'] = [], freshness: FieldQuality['freshness'] = 'fresh'): FieldQuality {
  return { health, freshness, safety: health === 'healthy' ? 'valid' : 'blocked', fallback: health === 'healthy' ? 'none' : 'reject', quality: health === 'healthy' ? 'good' : 'unavailable', last_real_change: NOW, reasons };
}

interface Evaluated { contracts: Contract[]; diagnostics: DiagnosticProjection[]; health: HealthItem[]; graph: GraphSnapshot }

export function evaluate(payload: RegistryPayload, states: NonNullable<HassLike['states']>, revision: number): Evaluated {
  const devices = payload.devices ?? [];
  const usable = (binding: EditableBinding) => {
    if (binding.enabled === false) return { ok: false, code: 'source_unavailable', message: 'binding disabled' };
    if (!states[binding.entity_id] || states[binding.entity_id].state === 'unavailable') return { ok: false, code: 'source_unavailable', message: 'source unavailable' };
    const device = devices.find((item) => item.device_id === binding.device_id);
    const cadence = binding.device_overrides?.source_cadence ?? device?.source_cadence ?? 'unknown';
    if (cadence === 'unknown') return { ok: false, code: 'device_timestamp_required', message: 'cadence unknown: device timestamp required' };
    return { ok: true, code: '', message: '' };
  };
  const contracts: Contract[] = payload.contract_instances.map((instance) => {
    const contractId = String(instance.contract_id);
    const fusions = payload.fusions.filter((fusion) => fusion.contract_id === contractId);
    const contract: Contract = { contract_id: contractId, schema_id: String(instance.schema_id), schema_version: Number(instance.schema_version ?? 1), values: {}, field_states: {}, field_quality: {}, health: 'healthy', generated_at: NOW, lineage: {}, field_evaluations: {} };
    for (const fusion of fusions) {
      const candidates = fusion.input_binding_ids.map((id) => payload.bindings.find((binding) => binding.binding_id === id)).filter((binding): binding is EditableBinding => Boolean(binding));
      const active = candidates.find((binding) => usable(binding).ok) ?? null;
      const first = candidates[0];
      const verdict = first ? usable(first) : { ok: false, code: 'required_value_missing', message: 'no binding' };
      contract.values[fusion.field] = active ? states[active.entity_id]?.state ?? null : null;
      contract.field_states[fusion.field] = active ? 'valid' : 'unknown';
      contract.field_quality[fusion.field] = active ? quality('healthy') : quality('blocked', [{ code: verdict.code, message: verdict.message, field: fusion.field, source_entity: first?.entity_id ?? null, since: NOW, duration_seconds: 120, blocking: true, consumer_effect: 'consumer_blocked' }], 'unknown');
      contract.lineage[fusion.field] = active ? [active.binding_id] : [];
      contract.field_evaluations[fusion.field] = { field: fusion.field, state: active ? 'valid' : 'unknown', active_binding_ids: active ? [active.binding_id] : [], candidate_binding_ids: candidates.map((binding) => binding.binding_id), completeness: Boolean(active), strategy: fusion.strategy, note: active ? null : verdict.code };
    }
    const healths = Object.values(contract.field_quality).map((item) => item.health);
    contract.health = healths.includes('blocked') ? 'blocked' : healths.includes('degraded') ? 'degraded' : healths.length ? 'healthy' : 'unknown';
    return contract;
  });
  const diagnostics: DiagnosticProjection[] = contracts.map((contract) => ({
    projection_id: `diagnostic:${contract.contract_id}`, contract_id: contract.contract_id, schema_id: contract.schema_id, health: contract.health, generated_at: NOW, profile: 'benni', registry_revision: revision, registry_revision_id: `r${revision}`,
    fields: Object.keys(contract.field_quality).map((field) => {
      const fusion = payload.fusions.find((item) => item.contract_id === contract.contract_id && item.field === field);
      const bindingIds = fusion?.input_binding_ids ?? [];
      const bindings = bindingIds.map((id) => payload.bindings.find((binding) => binding.binding_id === id)).filter((binding): binding is EditableBinding => Boolean(binding));
      const q = contract.field_quality[field];
      const device = devices.find((item) => item.device_id === bindings[0]?.device_id);
      return { field, state: contract.field_states[field], health: q.health, quality: q.quality, freshness: q.freshness, safety: q.safety, source_entities: bindings.map((binding) => binding.entity_id), active_source_entities: contract.lineage[field].map((id) => bindings.find((binding) => binding.binding_id === id)?.entity_id ?? id), completeness: q.health === 'healthy', root_causes: q.reasons, consumer_effect: q.health === 'healthy' ? 'available_to_declared_consumers' : 'consumer_blocked', binding_ids: bindingIds, bindings: bindings.map((binding) => ({ binding_id: binding.binding_id, entity_id: binding.entity_id, enabled: binding.enabled !== false, fallback: binding.fallback })), value: contract.values[field], fallback: q.fallback, consumer_impact: (fusion?.consumer_ids ?? []).map((consumer_id) => ({ consumer_id, status: q.health })),
        freshness_assessment: { status: q.freshness, reason: q.reasons[0]?.code ?? null, basis: device?.liveness_entity ? 'device_liveness' : 'ttl', cadence: bindings[0]?.device_overrides?.source_cadence ?? device?.source_cadence ?? 'unknown', cadence_source: bindings[0]?.device_overrides?.source_cadence ? 'binding_override' : device ? 'device' : 'legacy_unknown', cadence_provenance: device?.cadence_provenance.kind === 'label' ? `label:${device.cadence_provenance.label_id}` : device ? 'manual' : null, value_timestamp: NOW, value_timestamp_origin: 'ha_state_event', value_age_seconds: 42, ttl_seconds: bindings[0]?.freshness_ttl_seconds ?? 300, expected_interval_s: bindings[0]?.device_overrides?.expected_interval_s ?? device?.expected_interval_s ?? null, liveness_configured: Boolean(device?.liveness_entity), liveness_entity: device?.liveness_entity ?? null, liveness_status: device?.liveness_entity ? 'alive' : 'not_applicable', liveness_timestamp: device?.liveness_entity ? NOW : null, liveness_age_seconds: device?.liveness_entity ? 30 : null, plausibility_reason: null, shared_binding_count: 1 },
      };
    }),
  }));
  const graph: GraphSnapshot = {
    revision,
    bindings: payload.bindings.map((binding) => clone(binding) as SourceBinding),
    signals: payload.bindings.map((binding) => ({ signal_id: `signal.${binding.binding_id}`, binding_id: binding.binding_id, field: binding.field, value: states[binding.entity_id]?.state ?? null, evidence: { received_at: NOW, origin: 'ha_state_event', device_timestamp: null, ha_timestamp: NOW, retained: false, restored: false, ha_state_event: true }, quality: usable(binding).ok ? quality('healthy') : quality('blocked', [{ code: usable(binding).code, message: usable(binding).message, field: binding.field, source_entity: binding.entity_id, since: NOW, duration_seconds: 120, blocking: true, consumer_effect: 'consumer_blocked' }], 'unknown'), real_change_at: NOW })),
    fusions: clone(payload.fusions),
    contracts,
    diagnostics,
  };
  return { contracts, diagnostics, health: contracts.map((contract) => ({ contract_id: contract.contract_id, schema_id: contract.schema_id, health: contract.health })), graph };
}

export interface FakeBackend {
  hass: HassLike;
  calls: Record<string, unknown>[];
  revisions: Revision[];
  drafts: Record<string, Draft>;
  get active(): Revision;
  states: NonNullable<HassLike['states']>;
  /** Simulate an external activation (someone else saved) of a modified payload. */
  activateExternally(mutate: (payload: RegistryPayload) => void): void;
  fail: (code: string | null) => void;
}

export function createFakeBackend(options: { admin?: boolean; payload?: RegistryPayload; states?: NonNullable<HassLike['states']> } = {}): FakeBackend {
  const calls: Record<string, unknown>[] = [];
  const states = options.states ?? fakeHassStates();
  const revisions: Revision[] = [{ id: 'r1', revision: 1, profile: 'benni', status: 'active', created_at: NOW, payload: options.payload ?? frontDoorPayload() }];
  const drafts: Record<string, Draft> = {};
  let failure: string | null = null;
  let draftCounter = 0;
  const active = () => revisions.find((item) => item.status === 'active')!;
  const schemas = [
    { schema_id: 'opening', version: 1, fields: [{ name: 'opening_state', value_type: 'string' }, { name: 'is_open', value_type: 'boolean' }, { name: 'available', value_type: 'boolean' }] },
    { schema_id: 'room_climate', version: 1, fields: [{ name: 'temperature', value_type: 'number' }, { name: 'humidity', value_type: 'number' }] },
  ];
  const view = (): RegistryView => ({
    schemas,
    registry: { profile: 'benni', revision: clone(active()), source: 'postgres', health: 'healthy', reason: null, used_last_known_good: false },
    revisions: clone(revisions), history_error: null,
    requirements: [
      { consumer_id: 'door_policy', contract_id: 'opening.front_door', role: 'opening_state', status: evaluate(active().payload, states, active().revision).health.find((item) => item.contract_id === 'opening.front_door')?.health ?? 'unknown' },
      { consumer_id: 'climate_policy', contract_id: 'room.living', role: 'temperature', status: 'healthy' },
      { consumer_id: 'wake_planner', contract_id: null, role: 'presence', status: 'missing' },
    ],
  });
  const proposal = (entityId: string): DeviceProposal => entityId === 'binary_sensor.front_door_contact' ? {
    entity_id: entityId, device_id: 'device-front-door', device_link_found: true,
    cadence: { conflict: false, suggested_source_cadence: 'event_based', suggested_provenance: { kind: 'label', label_id: 'contact_sensor' }, requires_confirmation: true, requires_cadence_selection: false, options: [{ source_cadence: 'event_based', evidence: [{ label_id: 'contact_sensor', label_name: 'contact_sensor', origin: 'aus Label contact_sensor' }] }] },
    liveness_candidates: [{ entity_id: 'sensor.front_door_last_seen', disabled: false, origin: 'Geschwister-Entity mit device_class timestamp' }],
    suggested_liveness_entity: 'sensor.front_door_last_seen', requires_liveness_selection: false,
    expected_interval_defaults: { event_based: { seconds: 172800, provisional: true }, periodic: { seconds: 3600, provisional: true } },
  } : { entity_id: entityId, device_id: null, device_link_found: false, cadence: { conflict: false, suggested_source_cadence: null, suggested_provenance: null, requires_confirmation: true, requires_cadence_selection: true, options: [] }, liveness_candidates: [], suggested_liveness_entity: null, requires_liveness_selection: false, expected_interval_defaults: { event_based: { seconds: 172800, provisional: true }, periodic: { seconds: 3600, provisional: true } } };
  const hass: HassLike = {
    user: { id: 'admin', is_admin: options.admin ?? true },
    states,
    devices: fakeHassDevices(),
    connection: {
      async sendMessagePromise<T>(message: Record<string, unknown>): Promise<T> {
        calls.push(clone(message));
        const type = message.type as string;
        const current = active();
        const evaluated = evaluate(current.payload, states, current.revision);
        const base = { payload_version: 1, command: type, revision: current.revision, delta: { supported: false, mode: 'full', since_revision: null, unchanged: false } };
        if (type.endsWith('/list_contracts')) return clone({ ...base, contracts: evaluated.contracts }) as T;
        if (type.endsWith('/get_contract')) return clone({ ...base, contract: evaluated.contracts.find((item) => item.contract_id === message.contract_id) }) as T;
        if (type.endsWith('/get_diagnostics')) return clone({ ...base, diagnostics: evaluated.diagnostics }) as T;
        if (type.endsWith('/get_graph')) return clone({ ...base, graph: evaluated.graph }) as T;
        if (type.endsWith('/get_health')) return clone({ ...base, health: evaluated.health }) as T;
        const command = type.split('/registry/')[1];
        if (!command) throw { code: 'invalid_command', message: type };
        if (command === 'view') return clone(view()) as T;
        if (failure) throw { code: failure, message: failure };
        const draftOf = () => { const draft = drafts[String(message.draft_id)]; if (!draft) throw { code: 'draft_not_found', message: 'draft not found' }; return draft; };
        let result: unknown;
        if (command === 'draft/create') { if (message.expected_base_revision !== undefined && message.expected_base_revision !== current.revision) throw { code: 'revision_conflict', message: 'registry base revision has changed' }; const draft: Draft = { draft_id: `draft-${++draftCounter}`, profile: (message.profile as Profile) ?? 'benni', base_revision: current.revision, payload: clone(current.payload) }; drafts[draft.draft_id] = draft; result = { draft }; }
        else if (command === 'draft/get') result = { draft: draftOf() };
        else if (command === 'binding/create') { const draft = draftOf(); draft.payload.bindings.push(normalizeBinding(message.binding as EditableBinding)); result = { draft }; }
        else if (command === 'binding/update') { const draft = draftOf(); draft.payload.bindings = draft.payload.bindings.map((item) => item.binding_id === message.binding_id ? normalizeBinding(message.binding as EditableBinding) : item); result = { draft }; }
        else if (command === 'binding/delete') { const draft = draftOf(); draft.payload.bindings = draft.payload.bindings.filter((item) => item.binding_id !== message.binding_id); result = { draft }; }
        else if (command === 'binding/set_enabled') { const draft = draftOf(); const binding = draft.payload.bindings.find((item) => item.binding_id === message.binding_id); if (binding) binding.enabled = message.enabled as boolean; result = { draft }; }
        else if (command === 'device/suggest') result = { result: proposal(message.entity_id as string) };
        else if (command === 'device/create') { const draft = draftOf(); (draft.payload.devices ??= []).push(clone(message.device as Device)); draft.payload.schema_version = 2; result = { draft }; }
        else if (command === 'device/update') { const draft = draftOf(); draft.payload.devices = (draft.payload.devices ?? []).map((item) => item.device_id === message.device_id ? clone(message.device as Device) : item); result = { draft }; }
        else if (command === 'device/delete') { const draft = draftOf(); draft.payload.devices = (draft.payload.devices ?? []).filter((item) => item.device_id !== message.device_id); result = { draft }; }
        else if (command === 'fusion/create') { const draft = draftOf(); draft.payload.fusions.push(clone(message.fusion as RegistryPayload['fusions'][number])); result = { draft }; }
        else if (command === 'fusion/update') { const draft = draftOf(); draft.payload.fusions = draft.payload.fusions.map((item) => item.fusion_id === message.fusion_id ? clone(message.fusion as RegistryPayload['fusions'][number]) : item); result = { draft }; }
        else if (command === 'fusion/delete') { const draft = draftOf(); draft.payload.fusions = draft.payload.fusions.filter((item) => item.fusion_id !== message.fusion_id); result = { draft }; }
        else if (command === 'contract_instance/create') { const draft = draftOf(); draft.payload.contract_instances.push(clone(message.instance as Record<string, unknown>)); result = { draft }; }
        else if (command === 'contract_instance/update') { const draft = draftOf(); draft.payload.contract_instances = draft.payload.contract_instances.map((item) => item.contract_id === message.contract_id ? clone(message.instance as Record<string, unknown>) : item); result = { draft }; }
        else if (command === 'contract_instance/delete') { const draft = draftOf(); draft.payload.contract_instances = draft.payload.contract_instances.filter((item) => item.contract_id !== message.contract_id); result = { draft }; }
        else if (command === 'draft/validate') { const draft = draftOf(); const errors = draft.payload.bindings.filter((item) => !item.entity_id || !item.field).map((item) => ({ code: 'validation_error', message: `binding ${item.binding_id} is incomplete`, path: `bindings.${item.binding_id}` })); result = { validation: { draft_id: draft.draft_id, profile: 'benni', base_revision: draft.base_revision, valid: !errors.length, errors, graph_probe: { performed: true, revision: draft.base_revision } } }; }
        else if (command === 'draft/save') {
          const draft = draftOf();
          if (message.expected_base_revision !== current.revision) throw { code: 'revision_conflict', message: 'registry base revision has changed' };
          if (draft.payload.bindings.some((item) => !item.entity_id || !item.field)) throw { code: 'validation_error', message: 'registry validation failed' };
          current.status = 'superseded';
          const next: Revision = { id: `r${current.revision + 1}`, revision: current.revision + 1, profile: 'benni', status: 'active', created_at: NOW, payload: clone(draft.payload) };
          revisions.push(next); delete drafts[draft.draft_id]; result = { revision: clone(next) };
        }
        else if (command === 'draft/discard') { delete drafts[String(message.draft_id)]; result = { discarded: true }; }
        else if (command === 'rollback') { const target = revisions.find((item) => item.id === message.revision_id); if (!target) throw { code: 'revision_not_found', message: 'revision not found' }; current.status = 'superseded'; const next: Revision = { id: `r${current.revision + 1}`, revision: current.revision + 1, profile: 'benni', status: 'active', created_at: NOW, payload: clone(target.payload) }; revisions.push(next); result = { revision: clone(next) }; }
        else if (command === 'export') result = { result: { format: 'core-contracts-registry', format_version: 1, payload: clone(current.payload) } };
        else if (command === 'import') { const document = message.document as { payload: RegistryPayload }; const draft: Draft = { draft_id: `draft-${++draftCounter}`, profile: 'benni', base_revision: current.revision, payload: clone(document.payload) }; drafts[draft.draft_id] = draft; result = { result: { draft, validation: { valid: true, errors: [] } } }; }
        else if (command === 'migration_candidates') result = { result: { candidates: [] } };
        else throw { code: 'invalid_command', message: command };
        return clone(result) as T;
      },
    },
  };
  return {
    hass, calls, revisions, drafts, states,
    get active() { return active(); },
    activateExternally(mutate) { const current = active(); current.status = 'superseded'; const payload = clone(current.payload); mutate(payload); revisions.push({ id: `r${current.revision + 1}`, revision: current.revision + 1, profile: 'benni', status: 'active', created_at: NOW, payload }); },
    fail: (code) => { failure = code; },
  };
}
