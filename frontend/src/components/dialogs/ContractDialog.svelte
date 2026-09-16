<script lang="ts">
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { labelForSchema } from '../../lib/core-contracts/format';
  import Dialog from '../../lib/ui/Dialog.svelte';

  /** Full edit dialog for one contract instance. Schemas stay code-defined; only instance data is edited. */
  let { store }: { store: CoreContractsStore } = $props();
  let registry = $derived(store.registry);
  let editor = $derived(registry.instanceEditor);
  let isNew = $derived(registry.originalInstance === null);
  let schemas = $derived(registry.view?.schemas ?? []);
  let schemaKey = $derived(editor ? `${editor.schema_id}:${editor.schema_version}` : '');
  let schema = $derived(schemas.find((item) => `${item.schema_id}:${item.version}` === schemaKey));
  let fusions = $derived(registry.fusions.filter((fusion) => fusion.contract_id === editor?.contract_id));
  function cancel() {
    if (registry.formDirty && !window.confirm('Nicht gespeicherte Eingaben dieses Dialogs verwerfen? Der Entwurf bleibt unverändert.')) return;
    registry.cancelDialog();
  }
  function chooseSchema(value: string) {
    const selected = schemas.find((item) => `${item.schema_id}:${item.version}` === value);
    if (selected && editor) { editor.schema_id = selected.schema_id; editor.schema_version = selected.version; }
  }
</script>

{#if editor}
  <Dialog title={isNew ? 'Neuen Vertrag anlegen' : `Vertrag bearbeiten: ${String(registry.originalInstance?.display_name ?? registry.originalInstance?.contract_id ?? '')}`} subtitle={`Technische ID ${String(editor.contract_id)} · Profil ${registry.profile}`} busy={registry.busy} saveDisabled={registry.externalChange} onSave={() => registry.saveDialog()} onCancel={cancel}>
    {#if registry.externalChange}
      <div class="inline-notice warning" role="alert">
        <p><strong>Dieser Vertrag wurde extern geändert</strong> (aktive Version {registry.activeRevision ?? '—'}). Ihre Eingaben wurden nicht angetastet.</p>
        <div class="actions">
          <button type="button" class="secondary small" onclick={() => registry.resolveExternal('keep')} disabled={registry.draft !== null && registry.draft.base_revision !== registry.activeRevision}>Meine Eingaben behalten</button>
          <button type="button" class="secondary small" onclick={() => registry.resolveExternal('load')}>Aktuelle Daten laden</button>
          <button type="button" class="secondary small" onclick={() => registry.cancelDialog()}>Abbrechen</button>
        </div>
      </div>
    {/if}
    {#if registry.error}<p class="inline-notice danger" role="alert">{registry.error.message}</p>{/if}
    <fieldset class="section" disabled={registry.busy}>
      <legend>Vertrag</legend>
      <div class="form-grid">
        <label class="field"><span>Anzeigename</span><input data-autofocus value={String(editor.display_name ?? '')} oninput={(event) => { if (editor) editor.display_name = event.currentTarget.value; }} required placeholder="z. B. Wohnzimmer" /></label>
        <label class="field"><span>Schema</span><select value={schemaKey} disabled={!isNew} required onchange={(event) => chooseSchema(event.currentTarget.value)}><option value="">Schema auswählen</option>{#each schemas as item (`${item.schema_id}:${item.version}`)}<option value={`${item.schema_id}:${item.version}`}>{labelForSchema(item.schema_id)} v{item.version}{store.preferences.technicalNames ? ` (${item.schema_id})` : ''}</option>{/each}</select><span class="help">{isNew ? 'Schemata sind im Code definiert und versioniert.' : 'Das Schema einer bestehenden Instanz ist geschützt.'}</span></label>
        <label class="field"><span>Technische ID (geschützt)</span><input value={String(editor.contract_id)} readonly /></label>
        <label class="field"><span>Profil (geschützt)</span><input value={String(editor.profile ?? registry.profile)} readonly /></label>
      </div>
    </fieldset>
    <fieldset class="section">
      <legend>Felder des Schemas</legend>
      {#if schema}
        <ul class="fields">{#each schema.fields as field (field.name)}{@const fusion = fusions.find((item) => item.field === field.name)}<li><span>{field.name}</span><span class="quiet">{field.value_type}</span><span class="quiet">{fusion ? `Zusammenführung ${fusion.fusion_id}` : 'noch keine Zusammenführung'}</span></li>{/each}</ul>
        <p class="intro">Zusammenführungen werden unter Quellen → Zusammenführungen angelegt und bearbeitet.</p>
      {:else}<p class="quiet">Schema auswählen, um die Felder zu sehen.</p>{/if}
    </fieldset>
    {#snippet footer()}
      <p class="foot-note">Speichern übernimmt den Vertrag in den Entwurf. Erst „Speichern und aktivieren“ ändert die aktive Version.</p>
    {/snippet}
  </Dialog>
{/if}

<style>
  .fields { display: grid; gap: var(--space-1); margin: 0; padding-left: var(--space-4); font-size: 0.8rem; }
  .fields li { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.4fr); gap: var(--space-2); }
  .foot-note { margin: 0; color: var(--color-text-muted); font-size: 0.72rem; line-height: 1.45; }
</style>
