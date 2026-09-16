<script lang="ts">
  import { Link2, Search, Unlink } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import type { SourceCadence } from '../../lib/core-contracts/types';
  import { describeDevice, effectiveCadence } from '../../lib/core-contracts/listing';
  import { CADENCE_LABELS, FALLBACK_LABELS, labelForCadence, labelForCadenceSource } from '../../lib/core-contracts/labels';
  import { formatDuration } from '../../lib/core-contracts/format';
  import Dialog from '../../lib/ui/Dialog.svelte';

  /**
   * Full edit dialog for one source binding. Everything stays local until
   * "Speichern" writes it into the server-side draft. Device proposals are
   * shown with their origin and never applied without explicit confirmation.
   */
  let { store }: { store: CoreContractsStore } = $props();
  let registry = $derived(store.registry);
  let editor = $derived(registry.editor);
  let isNew = $derived(registry.original === null);
  let hass = $derived(registry.hass);
  let entities = $derived(registry.entities);
  let schemaFields = $derived([...new Set((registry.view?.schemas ?? []).flatMap((schema) => schema.fields.map((field) => field.name)))].sort());
  let capabilities = $derived([...new Set([...(registry.view?.schemas ?? []).map((schema) => schema.schema_id), ...registry.bindings.map((binding) => binding.capability)])].filter(Boolean).sort());
  let devicesForPreview = $derived([...registry.devices.filter((item) => item.device_id !== registry.stagedDevice?.device_id), ...(registry.stagedDevice ? [registry.stagedDevice] : [])]);
  let effective = $derived(editor ? effectiveCadence(editor, devicesForPreview) : null);
  let linkedDevice = $derived(editor?.device_id ? describeDevice(hass, editor.device_id) : null);
  let linkedRegistryDevice = $derived(editor?.device_id ? devicesForPreview.find((item) => item.device_id === editor?.device_id) ?? null : null);
  let proposal = $derived(registry.deviceProposal);
  let proposalDevice = $derived(proposal?.device_id ? describeDevice(hass, proposal.device_id) : null);
  let entityName = $derived(editor?.entity_id ? hass?.states?.[editor.entity_id]?.attributes.friendly_name ?? '' : '');
  let entityExists = $derived(editor?.entity_id ? Boolean(hass?.states?.[editor.entity_id]) : true);
  let consumers = $derived(editor ? store.sourceRows.find((row) => row.id === editor?.binding_id)?.consumers ?? [] : []);
  let contracts = $derived(editor ? store.sourceRows.find((row) => row.id === editor?.binding_id)?.contracts ?? [] : []);
  let chooserOpen = $state(false);
  let existingChoice = $state('');
  let staleDraft = $derived(registry.externalChange && registry.draft !== null && registry.draft.base_revision !== registry.activeRevision);
  let showChooser = $derived(chooserOpen || !editor?.device_id);
  const overrides = $derived(editor?.device_overrides ?? {});

  function cancel() {
    if (registry.formDirty && !window.confirm('Nicht gespeicherte Eingaben dieses Dialogs verwerfen? Der Entwurf bleibt unverändert.')) return;
    registry.cancelDialog();
  }
  async function save() { await registry.saveDialog(); }
  function useExisting() {
    if (!existingChoice) return;
    registry.chooseExistingDevice(existingChoice);
    chooserOpen = false;
  }
  async function confirmProposal() {
    await registry.confirmDevice();
    if (!registry.error) chooserOpen = false;
  }
</script>

{#if editor}
  <Dialog title={isNew ? 'Neue Quelle anlegen' : `Quelle bearbeiten: ${registry.original?.display_name || registry.original?.entity_id || ''}`} subtitle={store.preferences.technicalNames || isNew ? `Technische ID ${editor.binding_id} · Profil ${editor.profile_id}` : `Profil ${editor.profile_id}`} wide busy={registry.busy} saveDisabled={!!registry.fallbackError || registry.externalChange} saveLabel="Speichern" onSave={save} onCancel={cancel}>
    {#if registry.externalChange}
      <div class="inline-notice warning" role="alert">
        <p><strong>Dieser Eintrag wurde extern geändert</strong>, während der Dialog geöffnet war (aktive Version {registry.activeRevision ?? '—'}). Ihre Eingaben wurden nicht angetastet. Entscheiden Sie, wie es weitergeht:</p>
        <div class="actions">
          <button type="button" class="secondary small" onclick={() => registry.resolveExternal('keep')} disabled={staleDraft}>Meine Eingaben behalten</button>
          <button type="button" class="secondary small" onclick={() => registry.resolveExternal('load')}>Aktuelle Daten laden</button>
          <button type="button" class="secondary small" onclick={() => registry.cancelDialog()}>Abbrechen</button>
        </div>
        {#if registry.externalVersion === null}<p>Der Eintrag existiert in der aktiven Version nicht mehr.</p>{/if}
        {#if staleDraft}<p>Der Entwurf basiert auf Version {registry.draft?.base_revision}; Speichern würde als Versionskonflikt abgewiesen. Laden Sie die aktuellen Daten oder verwerfen Sie den Entwurf.</p>{/if}
      </div>
    {/if}
    {#if registry.error}<p class="inline-notice danger" role="alert">{registry.error.message}</p>{/if}

    <fieldset class="section" disabled={registry.busy}>
      <legend>Grunddaten</legend>
      <div class="form-grid">
        <label class="field"><span>Anzeigename</span><input data-autofocus bind:value={editor.display_name} required placeholder="z. B. Fensterkontakt Küche" /></label>
        <label class="field"><span>Home-Assistant-Entity</span><input list="binding-dialog-entities" bind:value={editor.entity_id} required placeholder="Entity suchen und ausdrücklich auswählen" aria-invalid={!entityExists} /><span class="help">{entityExists ? (entityName ? `Aktueller Name in Home Assistant: ${entityName}` : 'Die Entity-ID bleibt beim Gerätewechsel austauschbar; die technische ID der Quelle nicht.') : 'Diese Entity existiert aktuell nicht in Home Assistant.'}</span></label>
        <datalist id="binding-dialog-entities">{#each entities as entity (entity.entity_id)}<option value={entity.entity_id}>{entity.attributes.friendly_name ?? entity.entity_id}</option>{/each}</datalist>
        <label class="field"><span>Rolle / Vertragsfeld</span><input list="binding-dialog-fields" bind:value={editor.field} required placeholder="z. B. opening_state" /><span class="help">Welches Vertragsfeld diese Quelle beliefert.</span></label>
        <datalist id="binding-dialog-fields">{#each schemaFields as field (field)}<option value={field}></option>{/each}</datalist>
        <label class="field"><span>Capability</span><input list="binding-dialog-capabilities" bind:value={editor.capability} required placeholder="z. B. opening" /><span class="help">Fachliche Fähigkeit der Quelle, meist gleich dem Vertragsschema.</span></label>
        <datalist id="binding-dialog-capabilities">{#each capabilities as capability (capability)}<option value={capability}></option>{/each}</datalist>
        <label class="check"><input type="checkbox" bind:checked={editor.required} />Pflichtquelle (ohne verwendbaren Wert wird das Feld blockiert)</label>
        <label class="check"><input type="checkbox" bind:checked={editor.enabled} />Quelle aktiv</label>
      </div>
      {#if store.preferences.technicalNames || isNew}<p class="tech">binding_id {editor.binding_id} · source_id {editor.source_id}</p>{/if}
    </fieldset>

    <fieldset class="section" disabled={registry.busy}>
      <legend>Gerätebezug</legend>
      {#if editor.device_id}
        <div class="inline-notice success">
          <p><Link2 size={14} aria-hidden="true" /> <strong>{linkedDevice?.name ?? editor.device_id}</strong>{#if linkedDevice?.manufacturer || linkedDevice?.model} · {[linkedDevice?.manufacturer, linkedDevice?.model].filter(Boolean).join(' ')}{/if}{#if registry.stagedDevice?.device_id === editor.device_id} · <em>bestätigt, noch nicht gespeichert</em>{/if}</p>
          {#if linkedRegistryDevice}<p class="quiet">Meldeverhalten {labelForCadence(linkedRegistryDevice.source_cadence)} · Intervall {formatDuration(linkedRegistryDevice.expected_interval_s ?? null)} · Lebenszeichen {linkedRegistryDevice.liveness_entity ?? 'nicht festgelegt'} · Herkunft {linkedRegistryDevice.cadence_provenance.kind === 'label' ? `Label ${linkedRegistryDevice.cadence_provenance.label_id ?? ''}` : 'manuell bestätigt'}</p>{:else}<p class="quiet">Für dieses Gerät liegen im Entwurf keine bestätigten Gerätewerte vor.</p>{/if}
          {#if store.preferences.technicalNames}<p class="tech">device_id {editor.device_id}</p>{/if}
          <div class="actions">
            <button type="button" class="secondary small" onclick={() => (chooserOpen = !chooserOpen)}>{chooserOpen ? 'Auswahl schließen' : 'Bezug ersetzen'}</button>
            <button type="button" class="secondary small" onclick={() => { registry.clearDevice(); chooserOpen = false; }}><Unlink size={14} aria-hidden="true" /> Bezug entfernen</button>
          </div>
        </div>
      {:else}
        <div class="inline-notice info">
          <p><strong>Kein Gerätebezug.</strong> Diese Quelle verhält sich wie vor der Geräte-Registry: Frische wird nur über die Zeitgrenze bewertet. Ordnen Sie ein Gerät zu, um Meldeverhalten und Lebenszeichen zu bestätigen.</p>
        </div>
      {/if}
      {#if showChooser}
        <div class="chooser">
          <div class="chooser-block">
            <h4>Vorschlag aus Home Assistant</h4>
            <p class="intro">Der Vorschlag leitet sich aus der Entity-Registry-Verknüpfung und den Geräte-Labels ab. Er wird erst wirksam, wenn Sie ihn unten ausdrücklich übernehmen.</p>
            <button type="button" class="secondary" onclick={() => registry.suggestDevice()} disabled={!editor.entity_id || registry.busy}><Search size={16} aria-hidden="true" /> Vorschlag für {editor.entity_id || 'die gewählte Entity'} prüfen</button>
            {#if proposal}
              {#if !proposal.device_link_found}
                <p class="inline-notice">Für <code>{proposal.entity_id}</code> ist in der Home-Assistant-Entity-Registry kein Gerät hinterlegt. Ein bestehendes Gerät kann rechts gewählt werden.</p>
              {:else}
                <dl class="kv">
                  <div><dt>Vorgeschlagenes Gerät</dt><dd><strong>{proposalDevice?.name ?? proposal.device_id}</strong><br /><span class="quiet">vorgeschlagen aufgrund der Entity-Registry-Verknüpfung von {proposal.entity_id}</span>{#if store.preferences.technicalNames}<br /><span class="tech">{proposal.device_id}</span>{/if}</dd></div>
                  <div><dt>Meldeverhalten</dt><dd>
                    {#if proposal.cadence.conflict}<p class="inline-notice warning">Die Geräte-Labels widersprechen sich. Keine Option ist vorbelegt; bitte ausdrücklich wählen.</p>{/if}
                    {#each proposal.cadence.options as option (option.source_cadence)}<p class="quiet"><strong>{labelForCadence(option.source_cadence)}</strong>: vorgeschlagen aufgrund {option.evidence.map((item) => `des Labels ${item.label_name || item.label_id}`).join(', ')}</p>{/each}
                    {#if !proposal.cadence.options.length}<p class="quiet">Kein Label liefert einen Hinweis. Bitte manuell festlegen.</p>{/if}
                    <label class="field"><span>Meldeverhalten bestätigen</span><select value={registry.selectedCadence} onchange={(event) => registry.selectCadence(event.currentTarget.value as SourceCadence | '')} required><option value="">Bitte auswählen</option>{#each Object.entries(CADENCE_LABELS) as [value, label] (value)}<option {value}>{label}{value === proposal.cadence.suggested_source_cadence ? ' (vorgeschlagen)' : ''}</option>{/each}</select></label>
                  </dd></div>
                  <div><dt>Lebenszeichenquelle</dt><dd>
                    {#if proposal.requires_liveness_selection}<p class="inline-notice warning">Mehrere Zeitstempel-Entities gefunden. Keine ist vorbelegt; bitte wählen.</p>{/if}
                    <label class="field"><span>Timestamp-Entity des Geräts</span><select bind:value={registry.selectedLiveness}><option value="">Keine</option>{#each proposal.liveness_candidates.filter((item) => !item.disabled) as candidate (candidate.entity_id)}<option value={candidate.entity_id}>{candidate.entity_id} · {candidate.origin}{candidate.entity_id === proposal.suggested_liveness_entity ? ' (vorgeschlagen)' : ''}</option>{/each}</select></label>
                  </dd></div>
                  <div><dt>Erwartetes Meldeintervall</dt><dd>
                    <label class="field"><span>Sekunden (optional)</span><input type="number" min="1" step="1" value={registry.selectedExpectedInterval ?? ''} oninput={(event) => (registry.selectedExpectedInterval = event.currentTarget.value ? Number(event.currentTarget.value) : null)} /></label>
                    {#if registry.selectedCadence && proposal.expected_interval_defaults[registry.selectedCadence]?.provisional}<p class="quiet">Vorläufiger Standard für {labelForCadence(registry.selectedCadence)}: {formatDuration(proposal.expected_interval_defaults[registry.selectedCadence]?.seconds ?? null)}. Nach Beobachtung anpassen.</p>{/if}
                  </dd></div>
                </dl>
                <button type="button" class="primary" onclick={confirmProposal} disabled={registry.busy || !registry.selectedCadence || (proposal.requires_liveness_selection && !registry.selectedLiveness)}>Vorschlag ausdrücklich übernehmen</button>
              {/if}
            {/if}
          </div>
          <div class="chooser-block">
            <h4>Anderes Gerät wählen</h4>
            <p class="intro">Bereits bestätigte Geräte dieses Profils. Kadenz und Lebenszeichen werden vom Gerät geerbt.</p>
            {#if registry.devices.length}
              <label class="field"><span>Bestätigtes Gerät</span><select bind:value={existingChoice}><option value="">Bitte auswählen</option>{#each registry.devices as device (device.device_id)}<option value={device.device_id}>{describeDevice(hass, device.device_id)?.name ?? device.device_id} · {labelForCadence(device.source_cadence)}</option>{/each}</select></label>
              <button type="button" class="secondary" onclick={useExisting} disabled={!existingChoice}>Dieses Gerät zuordnen</button>
            {:else}
              <p class="quiet">Noch keine bestätigten Geräte im Entwurf.</p>
            {/if}
          </div>
        </div>
      {/if}
    </fieldset>

    <fieldset class="section" disabled={registry.busy}>
      <legend>Kadenz und Lebenszeichen</legend>
      {#if effective}
        <dl class="kv">
          <div><dt>Wirksames Meldeverhalten</dt><dd>{labelForCadence(effective.cadence)} <span class="quiet">· {labelForCadenceSource(effective.source)}</span></dd></div>
          <div><dt>Wirksames Intervall</dt><dd>{formatDuration(effective.expectedInterval)}</dd></div>
          <div><dt>Wirksame Lebenszeichenquelle</dt><dd>{effective.livenessEntity ?? 'nicht festgelegt'}</dd></div>
        </dl>
      {/if}
      <p class="intro">Überschreibungen gelten nur für diese Quelle und haben Vorrang vor dem Gerät.</p>
      <div class="form-grid">
        <label class="check"><input type="checkbox" checked={overrides.source_cadence !== undefined} onchange={(event) => registry.setDeviceOverride('source_cadence', event.currentTarget.checked, effective?.cadence ?? 'unknown')} />Meldeverhalten für diese Quelle überschreiben</label>
        {#if overrides.source_cadence !== undefined}<label class="field"><span>Meldeverhalten</span><select value={overrides.source_cadence} onchange={(event) => registry.updateDeviceOverride('source_cadence', event.currentTarget.value)}>{#each Object.entries(CADENCE_LABELS) as [value, label] (value)}<option {value}>{label}</option>{/each}</select></label>{:else}<span></span>{/if}
        <label class="check"><input type="checkbox" checked={'expected_interval_s' in overrides} onchange={(event) => registry.setDeviceOverride('expected_interval_s', event.currentTarget.checked, effective?.expectedInterval ?? null)} />Meldeintervall überschreiben</label>
        {#if 'expected_interval_s' in overrides}<label class="field"><span>Intervall in Sekunden (leer = geerbten Wert aufheben)</span><input type="number" min="1" step="1" value={overrides.expected_interval_s ?? ''} oninput={(event) => registry.updateDeviceOverride('expected_interval_s', event.currentTarget.value ? Number(event.currentTarget.value) : null)} /></label>{:else}<span></span>{/if}
        <label class="check"><input type="checkbox" checked={'liveness_entity' in overrides} onchange={(event) => registry.setDeviceOverride('liveness_entity', event.currentTarget.checked, effective?.livenessEntity ?? null)} />Lebenszeichenquelle überschreiben</label>
        {#if 'liveness_entity' in overrides}<label class="field"><span>Timestamp-Entity (leer = geerbten Wert aufheben)</span><input list="binding-dialog-entities" value={overrides.liveness_entity ?? ''} oninput={(event) => registry.updateDeviceOverride('liveness_entity', event.currentTarget.value || null)} /></label>{:else}<span></span>{/if}
      </div>
    </fieldset>

    <fieldset class="section" disabled={registry.busy}>
      <legend>Frische und Fallback</legend>
      <div class="form-grid">
        <label class="field"><span>Frischegrenze (Sekunden)</span><input type="number" min="1" step="1" bind:value={editor.freshness_ttl_seconds} required /><span class="help">Älter als diese Grenze gilt der Wert als veraltet (bei periodischen und Legacy-Quellen).</span></label>
        <label class="field"><span>Verhalten ohne verwendbaren Wert</span><select bind:value={editor.fallback.action}>{#each Object.entries(FALLBACK_LABELS) as [value, label] (value)}<option {value}>{label}</option>{/each}</select></label>
        <label class="field"><span>Fallback-Wert (JSON)</span><input value={registry.fallbackText} oninput={(event) => registry.setFallback(event.currentTarget.value)} aria-invalid={!!registry.fallbackError} /><span class="help">{registry.fallbackError || 'z. B. false, 0 oder "unknown"'}</span></label>
        <label class="field"><span>Begründung</span><input bind:value={editor.fallback.reason} /></label>
      </div>
    </fieldset>

    <fieldset class="section">
      <legend>Verwendung</legend>
      <dl class="kv">
        <div><dt>Verträge</dt><dd>{contracts.join(', ') || 'Noch von keiner Zusammenführung verwendet'}</dd></div>
        <div><dt>Verbraucher</dt><dd>{consumers.join(', ') || 'Keine deklarierten Verbraucher'}</dd></div>
      </dl>
    </fieldset>

    {#snippet footer()}
      <p class="foot-note">Speichern übernimmt die Eingaben in den Entwurf. Abbrechen verwirft nur die Eingaben dieses Dialogs. Die aktive Version ändert sich erst mit „Speichern und aktivieren“.</p>
    {/snippet}
  </Dialog>
{/if}

<style>
  .chooser { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
  .chooser-block { display: grid; align-content: start; gap: var(--space-3); min-width: 0; padding: var(--space-3); border: 1px dashed var(--color-border); border-radius: var(--radius-control); }
  .chooser-block h4 { margin: 0; font-size: 0.82rem; }
  .foot-note { margin: 0; color: var(--color-text-muted); font-size: 0.72rem; line-height: 1.45; }
  .inline-notice p :global(svg) { vertical-align: -2px; }
  @media (max-width: 760px) { .chooser, :global(.dialog .form-grid) { grid-template-columns: 1fr; } }
</style>
