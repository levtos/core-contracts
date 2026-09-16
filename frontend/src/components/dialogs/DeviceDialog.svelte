<script lang="ts">
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { describeDevice } from '../../lib/core-contracts/listing';
  import { CADENCE_LABELS, labelForCadence } from '../../lib/core-contracts/labels';
  import Dialog from '../../lib/ui/Dialog.svelte';

  /** Full edit dialog for one confirmed device: cadence, expected interval, liveness entity. */
  let { store }: { store: CoreContractsStore } = $props();
  let registry = $derived(store.registry);
  let editor = $derived(registry.deviceEditor);
  let info = $derived(editor ? describeDevice(registry.hass, editor.device_id) : null);
  let sources = $derived(editor ? store.sourceRows.filter((row) => row.binding.device_id === editor?.device_id) : []);
  let timestampEntities = $derived(registry.entities.filter((entity) => entity.attributes.device_class === 'timestamp'));
  function cancel() {
    if (registry.formDirty && !window.confirm('Nicht gespeicherte Eingaben dieses Dialogs verwerfen? Der Entwurf bleibt unverändert.')) return;
    registry.cancelDialog();
  }
</script>

{#if editor}
  <Dialog title={`Gerät bearbeiten: ${info?.name ?? editor.device_id}`} subtitle={`${[info?.manufacturer, info?.model].filter(Boolean).join(' ') || 'Home-Assistant-Gerät'}${store.preferences.technicalNames ? ` · ${editor.device_id}` : ''}`} busy={registry.busy} saveDisabled={registry.externalChange} onSave={() => registry.saveDialog()} onCancel={cancel}>
    {#if registry.externalChange}
      <div class="inline-notice warning" role="alert">
        <p><strong>Dieses Gerät wurde extern geändert</strong> (aktive Version {registry.activeRevision ?? '—'}). Ihre Eingaben wurden nicht angetastet.</p>
        <div class="actions">
          <button type="button" class="secondary small" onclick={() => registry.resolveExternal('keep')} disabled={registry.draft !== null && registry.draft.base_revision !== registry.activeRevision}>Meine Eingaben behalten</button>
          <button type="button" class="secondary small" onclick={() => registry.resolveExternal('load')}>Aktuelle Daten laden</button>
          <button type="button" class="secondary small" onclick={() => registry.cancelDialog()}>Abbrechen</button>
        </div>
      </div>
    {/if}
    {#if registry.error}<p class="inline-notice danger" role="alert">{registry.error.message}</p>{/if}
    <fieldset class="section" disabled={registry.busy}>
      <legend>Meldeverhalten</legend>
      <div class="form-grid">
        <label class="field"><span>Kadenz</span><select data-autofocus value={editor.source_cadence} onchange={(event) => { if (editor) { editor.source_cadence = event.currentTarget.value as typeof editor.source_cadence; editor.cadence_provenance = { kind: 'manual' }; } }}>{#each Object.entries(CADENCE_LABELS) as [value, label] (value)}<option {value}>{label}</option>{/each}</select><span class="help">Herkunft: {editor.cadence_provenance.kind === 'label' ? `Label ${editor.cadence_provenance.label_id ?? ''}` : 'manuell bestätigt'}. Eine Änderung gilt als manuelle Bestätigung.</span></label>
        <label class="field"><span>Erwartetes Meldeintervall (Sekunden)</span><input type="number" min="1" step="1" value={editor.expected_interval_s ?? ''} oninput={(event) => { if (editor) { const value = event.currentTarget.value; if (value) editor.expected_interval_s = Number(value); else delete editor.expected_interval_s; } }} /><span class="help">Leer lassen, wenn kein Intervall bekannt ist.</span></label>
        <label class="field span"><span>Lebenszeichenquelle (Timestamp-Entity)</span><input list="device-dialog-timestamps" value={editor.liveness_entity ?? ''} oninput={(event) => { if (editor) { const value = event.currentTarget.value; if (value) editor.liveness_entity = value; else delete editor.liveness_entity; } }} placeholder="z. B. sensor.<gerät>_last_seen" /><span class="help">Nur Entities mit device_class timestamp sind sinnvoll. Leer = kein Lebenszeichen; ereignisbasierte Werte gelten dann nicht als lebendig.</span></label>
        <datalist id="device-dialog-timestamps">{#each timestampEntities as entity (entity.entity_id)}<option value={entity.entity_id}>{entity.attributes.friendly_name ?? entity.entity_id}</option>{/each}</datalist>
      </div>
    </fieldset>
    <fieldset class="section">
      <legend>Zugeordnete Quellen</legend>
      {#if sources.length}<ul class="sources">{#each sources as row (row.id)}<li>{row.name} <span class="quiet">· {row.entityId} · {row.cadence.source === 'binding_override' ? `überschreibt: ${labelForCadence(row.cadence.cadence)}` : 'erbt vom Gerät'}</span></li>{/each}</ul>{:else}<p class="quiet">Keine Quelle verwendet dieses Gerät.</p>{/if}
    </fieldset>
    {#snippet footer()}
      <p class="foot-note">Speichern übernimmt die Gerätewerte in den Entwurf. Erst „Speichern und aktivieren“ ändert die aktive Version.</p>
    {/snippet}
  </Dialog>
{/if}

<style>
  .sources { display: grid; gap: var(--space-1); margin: 0; padding-left: var(--space-4); font-size: 0.8rem; }
  .foot-note { margin: 0; color: var(--color-text-muted); font-size: 0.72rem; line-height: 1.45; }
</style>
