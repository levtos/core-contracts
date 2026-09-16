<script lang="ts">
  import { ArrowDown, ArrowUp } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { STRATEGIES, STRATEGY_HELP, labelForStrategy } from '../../lib/core-contracts/labels';
  import Dialog from '../../lib/ui/Dialog.svelte';

  /**
   * Full edit dialog for one fusion: contract field, plain-language strategy,
   * ordered inputs. No free formulas, no wiring beyond the existing model.
   */
  let { store }: { store: CoreContractsStore } = $props();
  let registry = $derived(store.registry);
  let editor = $derived(registry.fusionEditor);
  let isNew = $derived(registry.originalFusion === null);
  let instances = $derived(registry.instances);
  let knownContract = $derived(instances.some((item) => item.contract_id === editor?.contract_id));
  let selectedSchema = $derived(knownContract ? registry.view?.schemas?.find((schema) => { const instance = instances.find((item) => item.contract_id === editor?.contract_id); return instance && schema.schema_id === instance.schema_id && schema.version === Number(instance.schema_version ?? 1); }) : registry.view?.schemas?.find((schema) => `${schema.schema_id}:${schema.version}` === registry.fusionSchema));
  let fieldOptions = $derived(selectedSchema?.fields ?? []);
  let requiredRoles = $derived(fieldOptions.filter((field) => field.name === editor?.field));
  let bindingCandidates = $derived(registry.bindings.filter((binding) => !editor?.field || binding.field === editor.field || editor.input_binding_ids.includes(binding.binding_id)));
  let missingInputs = $derived(editor ? [...editor.input_binding_ids.filter((id) => !registry.bindings.some((binding) => binding.binding_id === id)), ...editor.input_fusion_ids.filter((id) => !registry.fusions.some((fusion) => fusion.fusion_id === id))] : []);

  function cancel() {
    if (registry.formDirty && !window.confirm('Nicht gespeicherte Eingaben dieses Dialogs verwerfen? Der Entwurf bleibt unverändert.')) return;
    registry.cancelDialog();
  }
  function toggle(kind: 'input_binding_ids' | 'input_fusion_ids', id: string, checked: boolean) {
    if (!editor) return;
    editor[kind] = checked ? [...editor[kind], id] : editor[kind].filter((value) => value !== id);
  }
  function move(index: number, delta: number) {
    if (!editor) return;
    const ids = [...editor.input_binding_ids];
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    editor.input_binding_ids = ids;
  }
  function onContractChange() {
    const instance = instances.find((item) => item.contract_id === editor?.contract_id);
    if (instance) registry.fusionSchema = `${instance.schema_id}:${instance.schema_version ?? 1}`;
  }
  const bindingLabel = (id: string) => { const binding = registry.bindings.find((item) => item.binding_id === id); return binding ? `${binding.display_name?.trim() || binding.entity_id}${binding.required ? ' · Pflichtrolle' : ''}${binding.enabled === false ? ' · deaktiviert' : ''}` : `${id} (fehlt im Entwurf)`; };
</script>

{#if editor}
  <Dialog title={isNew ? 'Neue Zusammenführung anlegen' : `Zusammenführung bearbeiten: ${registry.originalFusion?.contract_id} · ${registry.originalFusion?.field}`} subtitle={store.preferences.technicalNames || isNew ? `Technische ID ${editor.fusion_id} · Profil ${registry.profile}` : `Profil ${registry.profile}`} wide busy={registry.busy} saveDisabled={registry.externalChange} onSave={() => registry.saveDialog()} onCancel={cancel}>
    {#if registry.externalChange}
      <div class="inline-notice warning" role="alert">
        <p><strong>Diese Zusammenführung wurde extern geändert</strong> (aktive Version {registry.activeRevision ?? '—'}). Ihre Eingaben wurden nicht angetastet.</p>
        <div class="actions">
          <button type="button" class="secondary small" onclick={() => registry.resolveExternal('keep')} disabled={registry.draft !== null && registry.draft.base_revision !== registry.activeRevision}>Meine Eingaben behalten</button>
          <button type="button" class="secondary small" onclick={() => registry.resolveExternal('load')}>Aktuelle Daten laden</button>
          <button type="button" class="secondary small" onclick={() => registry.cancelDialog()}>Abbrechen</button>
        </div>
      </div>
    {/if}
    {#if registry.error}<p class="inline-notice danger" role="alert">{registry.error.message}</p>{/if}

    <fieldset class="section" disabled={registry.busy}>
      <legend>Vertragsfeld</legend>
      <p class="intro">Eine Zusammenführung liefert genau ein Vertragsfeld. Reine Datenzusammenführung, keine Policy.</p>
      <div class="form-grid">
        <label class="field"><span>Vertrag</span><input data-autofocus list="fusion-dialog-contracts" bind:value={editor.contract_id} required disabled={!isNew} onchange={onContractChange} placeholder="Bestehenden Vertrag wählen oder neue ID eingeben" /><span class="help">{knownContract ? 'Bestehende Vertragsinstanz.' : editor.contract_id ? 'Neue Vertrags-ID: beim Speichern wird eine Instanz des gewählten Schemas im Entwurf angelegt.' : ''}</span></label>
        <datalist id="fusion-dialog-contracts">{#each instances as instance (String(instance.contract_id))}<option value={String(instance.contract_id)}>{String(instance.display_name ?? instance.schema_id)}</option>{/each}</datalist>
        <label class="field"><span>Schema (nur für neue Verträge)</span><select bind:value={registry.fusionSchema} disabled={knownContract} required={!knownContract}><option value="">Schema auswählen</option>{#each registry.view?.schemas ?? [] as schema (`${schema.schema_id}:${schema.version}`)}<option value={`${schema.schema_id}:${schema.version}`}>{schema.schema_id} v{schema.version}</option>{/each}</select></label>
        <label class="field"><span>Feld</span><select bind:value={editor.field} required><option value="">Feld auswählen</option>{#each fieldOptions as field (field.name)}<option value={field.name}>{field.name} ({field.value_type})</option>{/each}</select>{#if requiredRoles.length}<span class="help">Erwarteter Typ: {requiredRoles[0].value_type}. Quellen mit passender Rolle werden unten angeboten.</span>{/if}</label>
        <label class="field"><span>Strategie</span><select bind:value={editor.strategy}>{#each STRATEGIES as strategy (strategy)}<option value={strategy}>{labelForStrategy(strategy)}{store.preferences.technicalNames ? ` (${strategy})` : ''}</option>{/each}</select><span class="help">{STRATEGY_HELP[editor.strategy] ?? ''}</span></label>
      </div>
    </fieldset>

    <fieldset class="section" disabled={registry.busy}>
      <legend>Quellen als Eingänge</legend>
      <p class="intro">Ausdrücklich auswählen. Die Reihenfolge bestimmt die Priorität bei „Erste gesunde Quelle“.</p>
      {#if !bindingCandidates.length}<p class="quiet">Keine Quellen mit passender Rolle vorhanden. Legen Sie zuerst unter Quellenzuordnungen eine Quelle für das Feld „{editor.field || '…'}“ an.</p>{/if}
      <div class="candidates">
        {#each bindingCandidates as binding (binding.binding_id)}
          <label class="check"><input type="checkbox" checked={editor.input_binding_ids.includes(binding.binding_id)} onchange={(event) => toggle('input_binding_ids', binding.binding_id, event.currentTarget.checked)} />{binding.display_name?.trim() || binding.entity_id} <span class="quiet">· {binding.entity_id} · {binding.required ? 'Pflichtrolle' : 'optional'}{binding.enabled === false ? ' · deaktiviert' : ''}</span></label>
        {/each}
      </div>
      {#if editor.input_binding_ids.length}
        <ol class="order" aria-label="Reihenfolge der Eingänge">
          {#each editor.input_binding_ids as id, index (id)}
            <li><span>{bindingLabel(id)}</span><span class="order-actions"><button type="button" class="ghost icon small" aria-label={`${bindingLabel(id)} nach oben`} disabled={index === 0} onclick={() => move(index, -1)}><ArrowUp size={14} aria-hidden="true" /></button><button type="button" class="ghost icon small" aria-label={`${bindingLabel(id)} nach unten`} disabled={index === editor.input_binding_ids.length - 1} onclick={() => move(index, 1)}><ArrowDown size={14} aria-hidden="true" /></button></span></li>
          {/each}
        </ol>
      {/if}
    </fieldset>

    <fieldset class="section" disabled={registry.busy}>
      <legend>Andere Zusammenführungen als Eingänge</legend>
      {#if registry.fusions.filter((fusion) => fusion.fusion_id !== editor?.fusion_id).length}
        <div class="candidates">
          {#each registry.fusions.filter((fusion) => fusion.fusion_id !== editor?.fusion_id) as fusion (fusion.fusion_id)}
            <label class="check"><input type="checkbox" checked={editor.input_fusion_ids.includes(fusion.fusion_id)} onchange={(event) => toggle('input_fusion_ids', fusion.fusion_id, event.currentTarget.checked)} />{fusion.contract_id} · {fusion.field} <span class="quiet">· {labelForStrategy(fusion.strategy)}</span></label>
          {/each}
        </div>
      {:else}<p class="quiet">Keine weiteren Zusammenführungen vorhanden.</p>{/if}
      {#if missingInputs.length}<p class="inline-notice warning">Fehlende Eingänge im Entwurf: {missingInputs.join(', ')}</p>{/if}
      <p class="intro">Zyklen, falsche Typen und ungültige Strategien werden bei der Prüfung vom Backend abgewiesen.</p>
    </fieldset>

    {#snippet footer()}
      <p class="foot-note">Speichern übernimmt die Zusammenführung in den Entwurf. Erst „Speichern und aktivieren“ ändert die aktive Version.</p>
    {/snippet}
  </Dialog>
{/if}

<style>
  .candidates { display: grid; gap: var(--space-1); max-height: 260px; overflow: auto; }
  .order { display: grid; gap: var(--space-1); margin: 0; padding-left: var(--space-4); }
  .order li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); min-height: 36px; font-size: 0.8rem; }
  .order-actions { display: inline-flex; gap: 2px; }
  .foot-note { margin: 0; color: var(--color-text-muted); font-size: 0.72rem; line-height: 1.45; }
</style>
