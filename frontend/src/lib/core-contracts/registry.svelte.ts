import type { HassLike, SourceBinding, Fusion, SourceCadence } from './types';
import { buildDraftDiff, type DraftChange } from './draft-diff';

export type Profile = 'benni' | 'eltern';
export interface EditableBinding extends SourceBinding { display_name?: string; enabled?: boolean }
export interface RegistryPayload {
  profile: Profile; schema_version: number; bindings: EditableBinding[];
  fusions: Fusion[]; contract_instances: Record<string, unknown>[];
  consumer_overrides: Record<string, unknown>; registry_metadata: Record<string, unknown>;
  devices?: Device[];
}
export interface Device {
  device_id:string; source_cadence:SourceCadence; expected_interval_s?:number;
  liveness_entity?:string; cadence_provenance:{kind:'manual'|'label';label_id?:string};
}
export interface DeviceProposal {
  entity_id:string; device_id:string|null; device_link_found:boolean;
  cadence:{conflict:boolean; suggested_source_cadence:SourceCadence|null;
    suggested_provenance:{kind:'label';label_id:string}|null;
    requires_confirmation:boolean; requires_cadence_selection:boolean;
    options:{source_cadence:SourceCadence;evidence:{label_id:string;label_name:string;origin:string}[]}[]};
  liveness_candidates:{entity_id:string;disabled:boolean;origin:string}[];
  suggested_liveness_entity:string|null; requires_liveness_selection:boolean;
  expected_interval_defaults:Partial<Record<SourceCadence,{seconds:number;provisional:boolean}>>;
}
export interface Revision { id: string; revision: number; profile: Profile; status: string; created_at: string; payload: RegistryPayload }
export interface Draft { draft_id: string; profile: Profile; base_revision: number; payload: RegistryPayload }
export interface Validation { valid: boolean; errors: { code: string; message: string; path?: string }[] }
export interface RequirementUsage { consumer_id: string; contract_id: string | null; role: string | null; status: string }
export interface MigrationHint {entity_id:string; shared_candidate:boolean; references:{integration:string;field:string}[]}
export interface RegistryView {
  schemas?: {schema_id: string; version: number; fields: {name: string; value_type: string}[]}[];
  registry: { profile: Profile; revision: Revision | null; source: string; health: string; reason: string | null; used_last_known_good: boolean };
  revisions: Revision[]; history_error: string | null; requirements: RequirementUsage[];
}
export type DialogKind = 'binding' | 'fusion' | 'contract' | 'device';
export type DraftState = 'loading' | 'clean' | 'editing' | 'changed' | 'validated' | 'invalid';
export class RegistryError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Mirror the backend serialization: optional edit fields are only present when used. */
export function normalizeBinding(binding: EditableBinding): EditableBinding {
  const result = copy(binding);
  if (result.enabled !== false) delete result.enabled;
  if (result.display_name === undefined || result.display_name === null) delete result.display_name;
  if (result.device_id === undefined || result.device_id === null) delete result.device_id;
  if (!result.device_overrides || Object.keys(result.device_overrides).length === 0) delete result.device_overrides;
  return result;
}

/**
 * UI session only. Canonical persistence, validation and OCC remain in the
 * backend DomainService. Every write goes to the server-side draft; the active
 * revision changes only through an explicit `save()` (draft/save) or `rollback()`.
 */
export class RegistryEditor {
  onActivated: (()=>void) | null = null;
  profile = $state<Profile>('benni');
  view = $state<RegistryView | null>(null);
  draft = $state<Draft | null>(null);
  /** Which full edit dialog is open. Exactly one dialog can be open. */
  dialog = $state<DialogKind | null>(null);
  editor = $state<EditableBinding | null>(null);
  original = $state<EditableBinding | null>(null);
  fusionEditor = $state<Fusion | null>(null);
  originalFusion = $state<Fusion | null>(null);
  fusionSchema = $state('');
  instanceEditor = $state<Record<string, unknown> | null>(null);
  originalInstance = $state<Record<string, unknown> | null>(null);
  deviceEditor = $state<Device | null>(null);
  originalDevice = $state<Device | null>(null);
  importText = $state('');
  exportText = $state('');
  migrationHints = $state<MigrationHint[]>([]);
  deviceProposal = $state<DeviceProposal | null>(null);
  /** Device values confirmed in the dialog; written to the draft only on Save. */
  stagedDevice = $state<Device | null>(null);
  selectedCadence = $state<SourceCadence | ''>('');
  selectedLiveness = $state('');
  selectedExpectedInterval = $state<number | null>(null);
  selectedEntities = $state<string[]>([]);
  candidateQueue = $state<string[]>([]);
  filter = $state('');
  changed = $state(false);
  busy = $state(false);
  error = $state<RegistryError | null>(null);
  validation = $state<Validation | null>(null);
  notice = $state('');
  fallbackText = $state('null');
  fallbackError = $state('');
  lastActivatedRevision = $state<number | null>(null);
  /** Snapshot of the active entry when the dialog opened; detects external changes. */
  private openedActive = $state<string | null>(null);
  private editBase = $state<number | null>(null);
  hass = $state.raw<HassLike | null>(null);
  private generation = 0;
  get admin() { return this.hass?.user?.is_admin === true; }
  get fusionDirty() { return this.fusionEditor !== null && !same(this.fusionEditor, this.originalFusion); }
  get instanceDirty() { return this.instanceEditor !== null && !same(this.instanceEditor, this.originalInstance); }
  get deviceDirty() { return this.deviceEditor !== null && !same(this.deviceEditor, this.originalDevice); }
  get bindingDirty() { return this.editor !== null && (!same(this.editor, this.original) || this.stagedDevice !== null); }
  /** Open, not yet saved form input of the current dialog. */
  get formDirty() { return this.bindingDirty || this.fusionDirty || this.instanceDirty || this.deviceDirty || !!this.fallbackError; }
  get dirty() { return this.changed || this.formDirty; }
  get diffEntries(): DraftChange[] | null {
    const base=this.view?.registry.revision?.payload;
    if(!base)return null;
    const current=copy(this.draft?.payload??base);
    const upsert=(collection: Record<string,unknown>[],item:Record<string,unknown>|null,idKey:string)=>{if(!item)return;const index=collection.findIndex(value=>value[idKey]===item[idKey]);if(index>=0)collection[index]=copy(item);else collection.push(copy(item));};
    if(this.editor&&!same(this.editor,this.original))upsert(current.bindings as unknown as Record<string,unknown>[],normalizeBinding(this.editor) as unknown as Record<string,unknown>,'binding_id');
    if(this.stagedDevice){current.devices??=[];upsert(current.devices as unknown as Record<string,unknown>[],this.stagedDevice as unknown as Record<string,unknown>,'device_id');}
    if(this.fusionEditor&&this.fusionDirty)upsert(current.fusions as unknown as Record<string,unknown>[],this.fusionEditor as unknown as Record<string,unknown>,'fusion_id');
    if(this.instanceEditor&&this.instanceDirty)upsert(current.contract_instances,this.instanceEditor,'contract_id');
    if(this.deviceEditor&&this.deviceDirty){current.devices??=[];upsert(current.devices as unknown as Record<string,unknown>[],this.deviceEditor as unknown as Record<string,unknown>,'device_id');}
    return buildDraftDiff(base as unknown as Parameters<typeof buildDraftDiff>[0],current as unknown as Parameters<typeof buildDraftDiff>[1]);
  }
  get changeCount(){return this.diffEntries?.length??null;}
  /** Count of changes already written to the server-side draft (without open form input). */
  get savedChangeCount(){const base=this.view?.registry.revision?.payload;if(!base||!this.draft)return base?0:null;return buildDraftDiff(base as unknown as Parameters<typeof buildDraftDiff>[0],this.draft.payload as unknown as Parameters<typeof buildDraftDiff>[1]).length;}
  get draftState(): DraftState {
    if (!this.view) return 'loading';
    if (this.formDirty) return 'editing';
    if (!this.changeCount) return 'clean';
    if (this.validation) return this.validation.valid ? 'validated' : 'invalid';
    return 'changed';
  }
  get fusions() { return this.draft?.payload.fusions ?? this.view?.registry.revision?.payload.fusions ?? []; }
  get instances() { return this.draft?.payload.contract_instances ?? this.view?.registry.revision?.payload.contract_instances ?? []; }
  get bindings() { return this.draft?.payload.bindings ?? this.view?.registry.revision?.payload.bindings ?? []; }
  get devices() { return this.draft?.payload.devices ?? this.view?.registry.revision?.payload.devices ?? []; }
  get filteredBindings() { const q = this.filter.toLowerCase(); return this.bindings.filter(b => `${b.binding_id} ${b.display_name ?? ''} ${b.entity_id} ${b.field}`.toLowerCase().includes(q)); }
  get base() { return this.draft?.base_revision ?? this.editBase ?? this.view?.registry.revision?.revision ?? 0; }
  get activeRevision() { return this.view?.registry.revision?.revision ?? null; }
  get entities() { return Object.values(this.hass?.states ?? {}); }
  /** The entry the open dialog edits, as it exists in the active revision right now. */
  get externalVersion(): Record<string, unknown> | null {
    const payload = this.view?.registry.revision?.payload;
    if (!payload || !this.dialog) return null;
    if (this.dialog === 'binding') return (payload.bindings.find(item => item.binding_id === this.original?.binding_id) as unknown as Record<string, unknown>) ?? null;
    if (this.dialog === 'fusion') return (payload.fusions.find(item => item.fusion_id === this.originalFusion?.fusion_id) as unknown as Record<string, unknown>) ?? null;
    if (this.dialog === 'contract') return payload.contract_instances.find(item => item.contract_id === this.originalInstance?.contract_id) ?? null;
    if (this.dialog === 'device') return (payload.devices?.find(item => item.device_id === this.originalDevice?.device_id) as unknown as Record<string, unknown>) ?? null;
    return null;
  }
  /** True when the active revision changed this entry while the dialog is open. */
  get externalChange() { return this.dialog !== null && this.openedActive !== null && JSON.stringify(this.externalVersion) !== this.openedActive; }
  private snapshotActive() { this.openedActive = JSON.stringify(this.externalVersion); }
  setHass(hass: HassLike | null) {
    if (this.hass?.user?.id && this.hass.user.id !== hass?.user?.id) {
      this.generation++; this.view = null; this.clear();
      this.importText=''; this.exportText=''; this.migrationHints=[]; this.selectedEntities=[]; this.candidateQueue=[];
    }
    this.hass = hass;
  }
  async request<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.hass?.connection) throw new RegistryError('backend_unavailable', 'Keine Home-Assistant-Verbindung.');
    if (command !== 'view' && !this.admin) throw new RegistryError('unauthorized', 'Nur Administratoren dürfen Registry-Entwürfe bearbeiten.');
    try {
      const generation = this.generation;
      const response = await this.hass.connection.sendMessagePromise<T & { success?: boolean; result?: T; error?: { code: string; message: string } }>({type: `benni_core_contracts/registry/${command}`, ...args});
      if (generation !== this.generation) throw new RegistryError('session_changed', 'Sitzung gewechselt; alte Antwort verworfen.');
      if (response.success === false) throw response.error;
      return response.success === true ? response.result as T : response;
    } catch (cause) {
      const e = cause as { code?: string; message?: string };
      throw new RegistryError(e?.code ?? 'backend_unavailable', e?.message ?? 'Registry-Abfrage fehlgeschlagen.');
    }
  }
  private async run(action: () => Promise<void>): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true; this.error = null;
    try { await action(); return true; }
    catch (e) { this.error = e instanceof RegistryError ? e : new RegistryError('validation_error', e instanceof Error ? e.message : 'Ungültige Eingabe.'); return false; }
    finally { this.busy = false; }
  }
  private async read() {
    const generation = this.generation; const profile = this.profile;
    const next = await this.request<RegistryView>('view', {profile});
    if (generation !== this.generation || profile !== this.profile) return;
    if (next.registry.profile !== profile) throw new RegistryError('profile_mismatch', 'Antwort gehört zu einem anderen Profil.');
    // Tables and counters always show the latest active revision. An open
    // dialog keeps its own copy; `externalChange` tells the user when the
    // entry being edited changed underneath them. Nothing is merged silently.
    this.view = next;
  }
  /** Quiet background re-read of the active revision. Never touches drafts or open dialogs. */
  async poll() {
    if (this.busy || !this.hass?.connection) return;
    try { await this.read(); if (this.dialog && this.externalChange) this.notice = 'Der gerade bearbeitete Eintrag wurde extern geändert.'; }
    catch { /* keep the last known view; the read-only shell reports connection problems */ }
  }
  async refresh() { await this.run(async () => {
    await this.read();
    this.notice = this.dialog && this.externalChange ? 'Aktiver Stand aktualisiert. Der gerade bearbeitete Eintrag wurde extern geändert.' : this.dirty ? 'Aktiver Stand aktualisiert. Eigene Änderungen und Basisrevision bleiben erhalten.' : 'Aktiver Stand aktualisiert.';
  }); }
  async switchProfile(profile: Profile) {
    if (profile === this.profile) return;
    if (this.dirty || this.importText || this.busy) { this.notice = 'Zuerst Änderungen speichern oder ausdrücklich verwerfen. Profil bleibt unverändert.'; return; }
    await this.run(async () => {
      if (this.draft) await this.request('draft/discard', {draft_id: this.draft.draft_id});
      this.generation++; this.profile = profile; this.clear(); this.view = null; this.importText=''; this.exportText=''; this.migrationHints=[]; this.selectedEntities=[]; this.candidateQueue=[];
      await this.read();
    });
  }
  /** Open the full binding dialog for an existing binding or a new one. */
  select(binding: EditableBinding | null) {
    if (!this.admin || this.busy) return;
    if (this.formDirty) { this.notice = 'Offene Eingabe zuerst speichern oder abbrechen.'; return; }
    this.editBase ??= this.base;
    this.original = binding ? {...copy(binding), enabled: binding.enabled !== false} : null;
    this.editor = this.original ? copy(this.original) : {
      binding_id: `binding.${crypto.randomUUID()}`, source_id: `source.${crypto.randomUUID()}`,
      entity_id: '', field: '', capability: '', profile_id: this.profile, required: true,
      freshness_ttl_seconds: 300, consumer_ids: [], fallback: {action: 'none', default_value: null, reason: ''}, read_only: true,
      display_name: '', enabled: true,
    };
    this.fallbackText = JSON.stringify(this.editor.fallback.default_value ?? null); this.fallbackError = '';
    this.notice = ''; this.error = null;
    this.deviceProposal = null; this.stagedDevice = null; this.selectedCadence = ''; this.selectedLiveness = ''; this.selectedExpectedInterval=null;
    this.dialog = 'binding'; this.snapshotActive();
  }
  /** Ask the backend for the HA device and cadence/liveness proposals of the chosen entity. Nothing is applied automatically. */
  async suggestDevice() { await this.run(async()=>{
    if (!this.editor?.entity_id) throw new RegistryError('validation_error','Zuerst eine Entity auswählen.');
    const response=await this.request<{result:DeviceProposal}>('device/suggest',{entity_id:this.editor.entity_id});
    this.deviceProposal=response.result;
    this.selectedCadence=response.result.cadence.conflict ? '' : (response.result.cadence.suggested_source_cadence ?? '');
    this.selectedLiveness=response.result.requires_liveness_selection ? '' : (response.result.suggested_liveness_entity ?? '');
    const existing=this.devices.find(item=>item.device_id===response.result.device_id)?.expected_interval_s;
    const suggested=this.selectedCadence ? response.result.expected_interval_defaults[this.selectedCadence]?.seconds : undefined;
    this.selectedExpectedInterval=existing ?? suggested ?? null;
  }); }
  selectCadence(value:SourceCadence|'') {
    this.selectedCadence=value;
    if (value && this.deviceProposal) {
      this.selectedExpectedInterval=this.deviceProposal.expected_interval_defaults[value]?.seconds ?? null;
    } else {
      this.selectedExpectedInterval=null;
    }
  }
  /** Explicit confirmation of the proposal. Values are staged; the draft is written on Save. */
  async confirmDevice() { await this.run(async()=>{
    const proposal=this.deviceProposal;
    if (!this.editor || !proposal?.device_id) throw new RegistryError('validation_error','Keine HA-Gerätezuordnung vorhanden.');
    if (!this.selectedCadence) throw new RegistryError('validation_error','Kadenz ausdrücklich auswählen.');
    if (proposal.requires_liveness_selection && !this.selectedLiveness) throw new RegistryError('validation_error','Liveness-Entity ausdrücklich auswählen.');
    const evidence=proposal.cadence.options.find(o=>o.source_cadence===this.selectedCadence)?.evidence[0];
    const device:Device={device_id:proposal.device_id,source_cadence:this.selectedCadence,
      cadence_provenance:evidence?{kind:'label',label_id:evidence.label_id}:{kind:'manual'}};
    if (this.selectedLiveness) device.liveness_entity=this.selectedLiveness;
    if (this.selectedExpectedInterval !== null) {
      if (!Number.isInteger(this.selectedExpectedInterval) || this.selectedExpectedInterval <= 0) throw new RegistryError('validation_error','Meldeintervall muss eine positive ganze Zahl sein.');
      device.expected_interval_s=this.selectedExpectedInterval;
    }
    this.stagedDevice=device; this.editor.device_id=device.device_id;
    this.notice='Gerätewerte bestätigt. Sie werden erst mit „Speichern“ in den Entwurf übernommen.';
  }); }
  /** Pick an already confirmed registry device instead of the proposal. */
  chooseExistingDevice(deviceId: string) {
    if (!this.editor) return;
    if (!this.devices.some(item=>item.device_id===deviceId)) { this.notice='Dieses Gerät ist im Entwurf nicht vorhanden.'; return; }
    this.stagedDevice=null; this.editor.device_id=deviceId;
  }
  clearDevice() {
    if (!this.editor) return;
    this.stagedDevice=null; this.editor.device_id=undefined;
  }
  setDeviceOverride(key:'source_cadence'|'expected_interval_s'|'liveness_entity', enabled:boolean, value:unknown=null) {
    if (!this.editor) return;
    const overrides={...(this.editor.device_overrides ?? {})};
    if (enabled) Object.assign(overrides,{[key]:value}); else delete overrides[key];
    this.editor.device_overrides=overrides;
  }
  updateDeviceOverride(key:'source_cadence'|'expected_interval_s'|'liveness_entity', value:unknown) {
    if (!this.editor) return;
    this.editor.device_overrides={...(this.editor.device_overrides ?? {}),[key]:value};
  }
  async ensureDraft() {
    if (!this.draft) {
      const result = await this.request<{draft: Draft}>('draft/create', {profile: this.profile, expected_base_revision: this.base});
      if (result.draft.profile !== this.profile) throw new RegistryError('profile_mismatch', 'Entwurf gehört zu einem anderen Profil.');
      this.draft = result.draft;
    }
    return this.draft;
  }
  private async applyStagedDevice() {
    if (!this.stagedDevice) return;
    const device=copy(this.stagedDevice);
    const draft=await this.ensureDraft();
    const existing=this.devices.some(item=>item.device_id===device.device_id);
    const response=await this.request<{draft:Draft}>(existing?'device/update':'device/create',{draft_id:draft.draft_id,...(existing?{device_id:device.device_id}:{}),device});
    this.draft=response.draft; this.stagedDevice=null; this.changed=true; this.validation=null;
  }
  private async applyEditor() {
    if (this.fallbackError) throw new RegistryError('validation_error', this.fallbackError);
    if (!this.editor) return;
    await this.applyStagedDevice();
    if (same(this.editor, this.original)) return;
    const binding = normalizeBinding(this.editor);
    if (binding.profile_id !== this.profile || (this.original && (binding.binding_id !== this.original.binding_id || binding.source_id !== this.original.source_id))) throw new RegistryError('validation_error', 'Technische Identität und Profil sind geschützt.');
    if (!binding.entity_id || !binding.field || !binding.capability || !binding.display_name?.trim()) throw new RegistryError('validation_error', 'Anzeigename, Entity, Rolle/Feld und Capability sind erforderlich.');
    const draft = await this.ensureDraft();
    const response = await this.request<{draft: Draft}>(this.original ? 'binding/update' : 'binding/create', {draft_id: draft.draft_id, ...(this.original ? {binding_id: binding.binding_id} : {}), binding});
    this.draft = response.draft; this.changed = true; this.original = {...copy(binding), enabled: binding.enabled !== false}; this.editor = copy(this.original); this.validation = null;
  }
  /** Write the current dialog input into the server-side draft. Never activates. */
  async apply() { return this.run(() => this.applyEditor()); }
  setFallback(value: string) {
    this.fallbackText = value;
    try { const parsed: unknown = JSON.parse(value); if (this.editor) this.editor.fallback.default_value = parsed; this.fallbackError = ''; }
    catch { this.fallbackError = 'Fallback-Wert muss gültiges JSON sein (z. B. false, 0 oder "unknown").'; }
  }
  async remove(binding: EditableBinding) { await this.run(async () => {
    const draft = await this.ensureDraft();
    this.draft = (await this.request<{draft: Draft}>('binding/delete', {draft_id: draft.draft_id, binding_id: binding.binding_id})).draft;
    this.changed = true; this.validation = null;
    if (this.editor?.binding_id === binding.binding_id) { this.editor = null; this.original = null; this.stagedDevice = null; if (this.dialog === 'binding') this.dialog = null; }
    this.notice = 'Quelle im Entwurf entfernt. Erst „Speichern und aktivieren“ ändert die aktive Version.';
  }); }
  async toggle(binding: EditableBinding) { await this.run(async () => {
    if (this.editor?.binding_id === binding.binding_id && this.formDirty) throw new RegistryError('dirty_editor', 'Offene Eingabe zuerst speichern oder abbrechen.');
    const draft = await this.ensureDraft();
    this.draft = (await this.request<{draft: Draft}>('binding/set_enabled', {draft_id: draft.draft_id, binding_id: binding.binding_id, enabled: binding.enabled === false})).draft;
    this.changed = true; this.validation = null;
    this.notice = binding.enabled === false ? 'Quelle im Entwurf aktiviert.' : 'Quelle im Entwurf deaktiviert. Erst „Speichern und aktivieren“ ändert die aktive Version.';
  }); }
  /** Validate without persisting or activating anything. */
  async validate() { await this.run(async () => {
    await this.applyEditor(); await this.applyInstanceEditor(); await this.applyFusionEditor(); await this.applyDeviceEditor(); const draft = await this.ensureDraft();
    this.validation = (await this.request<{validation: Validation}>('draft/validate', {draft_id: draft.draft_id})).validation;
  }); }
  /** draft/save validates again, persists a revision and activates it atomically. */
  async save() { await this.run(async () => {
    await this.applyEditor(); await this.applyInstanceEditor(); await this.applyFusionEditor(); await this.applyDeviceEditor(); const draft = await this.ensureDraft();
    await this.request('draft/save', {draft_id: draft.draft_id, expected_base_revision: draft.base_revision});
    this.clear(); this.notice = 'Revision gespeichert und aktiviert.'; await this.read(); this.lastActivatedRevision = this.activeRevision; this.onActivated?.();
  }); }
  private clear() { this.draft = null; this.dialog = null; this.editor = null; this.original = null; this.fusionEditor = null; this.originalFusion = null; this.instanceEditor = null; this.originalInstance = null; this.deviceEditor = null; this.originalDevice = null; this.changed = false; this.validation = null; this.editBase = null; this.fallbackText = 'null'; this.fallbackError = ''; this.deviceProposal=null; this.stagedDevice=null; this.selectedCadence=''; this.selectedLiveness=''; this.selectedExpectedInterval=null; this.openedActive=null; }
  /** Close the dialog and drop only the not yet saved input of this dialog. */
  cancelDialog() {
    const hadExternal = this.externalChange;
    this.dialog = null; this.editor = null; this.original = null; this.fusionEditor = null; this.originalFusion = null; this.instanceEditor = null; this.originalInstance = null; this.deviceEditor = null; this.originalDevice = null;
    this.fallbackText = 'null'; this.fallbackError = ''; this.deviceProposal = null; this.stagedDevice = null; this.selectedCadence=''; this.selectedLiveness=''; this.selectedExpectedInterval=null; this.openedActive = null; this.error = null;
    if (!this.changed) this.editBase = null;
    this.notice = hadExternal ? 'Bearbeitung abgebrochen. Die Tabelle zeigt den zwischenzeitlich eingetroffenen Stand.' : '';
  }
  /**
   * Explicit decision after an external change of the edited entry.
   * `load` replaces the form with the external version; `keep` keeps the form.
   * Without a server-side draft the edit base moves to the new active revision,
   * so the later save builds on it. A stale server-side draft cannot be rebased;
   * the backend will refuse it with `revision_conflict`, which is reported.
   */
  resolveExternal(mode: 'keep' | 'load') {
    if (!this.dialog) return;
    if (mode === 'load') { this.loadExternal(); }
    if (!this.draft) { this.editBase = this.activeRevision; this.snapshotActive(); if (mode === 'keep') this.notice = `Eigene Eingaben behalten. Der Entwurf baut auf Version ${this.activeRevision ?? '—'} auf; nur dieser Eintrag erhält Ihre Werte.`; }
    else if (mode === 'keep') { this.notice = `Der Entwurf basiert auf Version ${this.draft.base_revision}, aktiv ist Version ${this.activeRevision ?? '—'}. Speichern wird als Versionskonflikt abgewiesen; Entwurf verwerfen und Änderungen erneut vornehmen.`; }
  }
  /** Replace the dialog form with the externally changed version. Explicit user decision. */
  loadExternal() {
    const external = this.externalVersion;
    if (!this.dialog) return;
    if (external === null) { this.cancelDialog(); this.notice = 'Der Eintrag wurde extern entfernt. Der Dialog wurde geschlossen.'; return; }
    if (this.dialog === 'binding') { const binding = external as unknown as EditableBinding; this.original = {...copy(binding), enabled: binding.enabled !== false}; this.editor = copy(this.original); this.fallbackText = JSON.stringify(this.editor.fallback.default_value ?? null); this.fallbackError=''; this.stagedDevice=null; this.deviceProposal=null; }
    if (this.dialog === 'fusion') { this.originalFusion = copy(external as unknown as Fusion); this.fusionEditor = copy(this.originalFusion); }
    if (this.dialog === 'contract') { this.originalInstance = copy(external); this.instanceEditor = copy(external); }
    if (this.dialog === 'device') { this.originalDevice = copy(external as unknown as Device); this.deviceEditor = copy(this.originalDevice); }
    this.snapshotActive(); this.notice = 'Aktuelle Daten geladen. Eigene Eingaben wurden verworfen.';
  }
  /** Save the open dialog into the draft and close it on success. */
  async saveDialog(): Promise<boolean> {
    const kind = this.dialog;
    if (!kind) return false;
    const ok = await this.run(async () => {
      if (kind === 'binding') await this.applyEditor();
      if (kind === 'fusion') await this.applyFusionEditor();
      if (kind === 'contract') await this.applyInstanceEditor();
      if (kind === 'device') await this.applyDeviceEditor();
    });
    if (ok) { this.cancelDialog(); this.notice = 'In den Entwurf übernommen. Erst „Speichern und aktivieren“ ändert die aktive Version.'; }
    return ok;
  }
  selectInstance(instance: Record<string, unknown> | null) {
    if (!this.admin || this.busy) return;
    if (this.formDirty) { this.notice='Offene Eingabe zuerst speichern oder abbrechen.'; return; }
    this.editBase ??= this.base;
    this.originalInstance=instance ? copy(instance) : null;
    this.instanceEditor=instance ? copy(instance) : {contract_id:`contract.${crypto.randomUUID()}`,profile:this.profile,display_name:'',schema_id:'',schema_version:1};
    this.notice=''; this.error=null; this.dialog='contract'; this.snapshotActive();
  }
  private async applyInstanceEditor() {
    if (!this.instanceEditor || !this.instanceDirty) return;
    const instance=copy(this.instanceEditor);
    if (instance.profile!==this.profile || (this.originalInstance && instance.contract_id!==this.originalInstance.contract_id)) throw new RegistryError('validation_error','Contract-ID und Profil sind geschützt.');
    if (!this.view?.schemas?.some(s=>s.schema_id===instance.schema_id && s.version===instance.schema_version)) throw new RegistryError('validation_error','Vorhandenes Contract-Schema auswählen.');
    const draft=await this.ensureDraft();
    this.draft=(await this.request<{draft:Draft}>(this.originalInstance?'contract_instance/update':'contract_instance/create',{draft_id:draft.draft_id,...(this.originalInstance?{contract_id:instance.contract_id}:{}),instance})).draft;
    this.originalInstance=copy(instance); this.changed=true; this.validation=null;
  }
  async applyInstance() { return this.run(()=>this.applyInstanceEditor()); }
  async removeInstance(instance: Record<string, unknown>) { await this.run(async()=>{
    if (this.instanceDirty && this.instanceEditor?.contract_id===instance.contract_id) throw new RegistryError('dirty_editor','Offene Contract-Eingabe zuerst übernehmen.');
    const draft=await this.ensureDraft();
    this.draft=(await this.request<{draft:Draft}>('contract_instance/delete',{draft_id:draft.draft_id,contract_id:instance.contract_id})).draft;
    this.changed=true; this.validation=null;
    if (this.instanceEditor?.contract_id===instance.contract_id) { this.instanceEditor=null; this.originalInstance=null; if (this.dialog==='contract') this.dialog=null; }
  }); }
  selectFusion(fusion: Fusion | null) {
    if (!this.admin || this.busy) return;
    if (this.formDirty) { this.notice='Offene Eingabe zuerst speichern oder abbrechen.'; return; }
    this.editBase ??= this.base;
    this.originalFusion=fusion ? copy(fusion) : null;
    this.fusionEditor=fusion ? copy(fusion) : {fusion_id:`fusion.${crypto.randomUUID()}`, contract_id:'', field:'', strategy:'first_healthy', input_binding_ids:[], input_fusion_ids:[], consumer_ids:[]};
    const instance=this.instances.find(i=>i.contract_id===fusion?.contract_id);
    this.fusionSchema=instance ? `${instance.schema_id}:${instance.schema_version ?? 1}` : '';
    this.notice=''; this.error=null; this.dialog='fusion'; this.snapshotActive();
  }
  private async applyFusionEditor() {
    if (!this.fusionEditor || !this.fusionDirty) return;
    const fusion=copy(this.fusionEditor);
    if (this.originalFusion && fusion.fusion_id!==this.originalFusion.fusion_id) throw new RegistryError('validation_error','Fusion-ID ist geschützt.');
    if (!fusion.contract_id || !fusion.field) throw new RegistryError('validation_error','Vertrag und Feld sind erforderlich.');
    if (!fusion.input_binding_ids.length && !fusion.input_fusion_ids.length) throw new RegistryError('validation_error','Mindestens eine Quelle oder Zusammenführung als Eingang auswählen.');
    const draft=await this.ensureDraft();
    if (!this.instances.some(i=>i.contract_id===fusion.contract_id)) {
      const schema=this.view?.schemas?.find(s=>`${s.schema_id}:${s.version}`===this.fusionSchema);
      if (!schema) throw new RegistryError('validation_error','Für eine neue Contract-Instanz ein vorhandenes Schema auswählen.');
      this.draft=(await this.request<{draft:Draft}>('contract_instance/create',{draft_id:draft.draft_id,instance:{contract_id:fusion.contract_id,schema_id:schema.schema_id,schema_version:schema.version,profile:this.profile}})).draft;
      this.changed=true;
    }
    this.draft=(await this.request<{draft:Draft}>(this.originalFusion?'fusion/update':'fusion/create',{draft_id:draft.draft_id, ...(this.originalFusion?{fusion_id:fusion.fusion_id}:{}), fusion})).draft;
    this.originalFusion=copy(fusion); this.changed=true; this.validation=null;
  }
  async applyFusion() { return this.run(()=>this.applyFusionEditor()); }
  async removeFusion(fusion: Fusion) { await this.run(async()=>{
    const draft=await this.ensureDraft();
    this.draft=(await this.request<{draft:Draft}>('fusion/delete',{draft_id:draft.draft_id,fusion_id:fusion.fusion_id})).draft;
    this.changed=true; this.validation=null;
    if (this.fusionEditor?.fusion_id===fusion.fusion_id) { this.fusionEditor=null; this.originalFusion=null; if (this.dialog==='fusion') this.dialog=null; }
  }); }
  selectDevice(device: Device | null) {
    if (!this.admin || this.busy) return;
    if (this.formDirty) { this.notice='Offene Eingabe zuerst speichern oder abbrechen.'; return; }
    this.editBase ??= this.base;
    this.originalDevice=device ? copy(device) : null;
    this.deviceEditor=device ? copy(device) : null;
    if (!this.deviceEditor) return;
    this.notice=''; this.error=null; this.dialog='device'; this.snapshotActive();
  }
  private async applyDeviceEditor() {
    if (!this.deviceEditor || !this.deviceDirty) return;
    const device=copy(this.deviceEditor);
    if (this.originalDevice && device.device_id!==this.originalDevice.device_id) throw new RegistryError('validation_error','Die Geräte-ID ist geschützt.');
    if (device.expected_interval_s !== undefined && (!Number.isInteger(device.expected_interval_s) || device.expected_interval_s <= 0)) throw new RegistryError('validation_error','Meldeintervall muss eine positive ganze Zahl sein.');
    if (!device.liveness_entity) delete device.liveness_entity;
    if (device.expected_interval_s === undefined || device.expected_interval_s === null) delete device.expected_interval_s;
    const draft=await this.ensureDraft();
    this.draft=(await this.request<{draft:Draft}>(this.originalDevice?'device/update':'device/create',{draft_id:draft.draft_id,...(this.originalDevice?{device_id:device.device_id}:{}),device})).draft;
    this.originalDevice=copy(device); this.changed=true; this.validation=null;
  }
  async applyDevice() { return this.run(()=>this.applyDeviceEditor()); }
  async removeDevice(device: Device) { await this.run(async()=>{
    const draft=await this.ensureDraft();
    this.draft=(await this.request<{draft:Draft}>('device/delete',{draft_id:draft.draft_id,device_id:device.device_id})).draft;
    this.changed=true; this.validation=null;
    if (this.deviceEditor?.device_id===device.device_id) { this.deviceEditor=null; this.originalDevice=null; if (this.dialog==='device') this.dialog=null; }
  }); }
  async exportRegistry() { await this.run(async()=>{
    const response=await this.request<{result:unknown}>('export',{profile:this.profile});
    this.exportText=JSON.stringify(response.result,null,2);
    this.notice='Aktive Registry exportiert. Ungespeicherte Änderungen sind nicht enthalten.';
  }); }
  async importRegistry() { await this.run(async()=>{
    if (this.dirty) throw new RegistryError('dirty_draft','Vor Import vorhandene Änderungen speichern oder verwerfen.');
    if (new TextEncoder().encode(this.importText).length>2_000_000) throw new RegistryError('validation_error','Import ist größer als 2 MB.');
    const document:unknown=JSON.parse(this.importText);
    if (this.draft) { await this.request('draft/discard',{draft_id:this.draft.draft_id}); this.draft=null; }
    const response=await this.request<{result:{draft:Draft;validation:Validation}}>('import',{profile:this.profile,expected_base_revision:this.base,document});
    this.clear(); this.draft=response.result.draft; this.validation=response.result.validation; this.changed=true;
    this.importText='';
    this.notice='Import geprüft und als Entwurf geladen. Erst Speichern aktiviert ihn.';
  }); }
  async migrationCandidates() { await this.run(async()=>{
    const response=await this.request<{result:{candidates:MigrationHint[]}}>('migration_candidates',{profile:this.profile});
    this.migrationHints=response.result.candidates;
  }); }
  createCandidates() {
    this.candidateQueue=[...new Set(this.selectedEntities)].filter(id=>this.entities.some(e=>e.entity_id===id));
    this.notice='Nur Kandidaten erzeugt. Für jede Entity Rolle und Capability ausdrücklich bestätigen.';
  }
  openCandidate(entityId:string) {
    if (!this.candidateQueue.includes(entityId) && !this.migrationHints.some(h=>h.entity_id===entityId)) return;
    this.select(null);
    if (this.editor && this.original===null && this.editor.entity_id==='') this.editor.entity_id=entityId;
  }
  /** Discard the whole draft. The active registry is never touched. */
  async discard() { await this.run(async () => {
    if (this.draft) await this.request('draft/discard', {draft_id: this.draft.draft_id});
    this.clear(); this.importText=''; this.notice = 'Entwurf verworfen. Aktive Registry unverändert.'; await this.read();
  }); }
  async rollback(revisionId: string) { await this.run(async () => {
    if (this.dirty) throw new RegistryError('dirty_draft', 'Vor Rollback Änderungen speichern oder verwerfen.');
    await this.request('rollback', {profile: this.profile, revision_id: revisionId, expected_base_revision: this.base});
    this.clear(); this.notice = 'Rollback aktiviert.'; await this.read(); this.lastActivatedRevision = this.activeRevision; this.onActivated?.();
  }); }
  consumers(binding: EditableBinding) {
    const payload = this.draft?.payload ?? this.view?.registry.revision?.payload;
    const affected = new Set<string>(); const contracts = new Set<string>();
    let changed = true;
    while (changed) { changed = false;
      for (const fusion of payload?.fusions ?? []) {
        if (!affected.has(fusion.fusion_id) && (fusion.input_binding_ids.includes(binding.binding_id) || fusion.input_fusion_ids.some(id => affected.has(id)))) {
          affected.add(fusion.fusion_id); contracts.add(fusion.contract_id); changed = true;
        }
      }
    }
    return [...new Set((this.view?.requirements ?? []).filter(r => r.role === binding.field || r.role === binding.binding_id || r.role === binding.capability || r.role === binding.source_id || (r.contract_id && contracts.has(r.contract_id))).map(r => r.consumer_id))];
  }
}
