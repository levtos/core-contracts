<script lang="ts">
  import { Download, History, RotateCcw, Upload } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { CHANGE_ACTION_LABELS, CHANGE_KIND_LABELS, FIELD_LABELS, draftImpact } from '../../lib/core-contracts/impact';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import HeroStats from '../../lib/ui/HeroStats.svelte';

  /**
   * Änderungen: draft state, real diff, validation, save/activate, import/export,
   * revision history and rollback. No binding, fusion or contract lists live here.
   */
  let { store }: { store: CoreContractsStore } = $props();
  let registry = $derived(store.registry);
  let changes = $derived(registry.diffEntries);
  let impact = $derived(changes ? draftImpact(changes, registry.fusions, registry.view?.requirements ?? [], registry.bindings) : null);
  let rollbackTarget = $state<{ id: string; revision: number } | null>(null);
  let confirmActivate = $state(false);
  let confirmDiscard = $state(false);
  const show = (value: unknown) => value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field;
  function download() {
    const url = URL.createObjectURL(new Blob([registry.exportText], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `core-contracts-${registry.profile}.json`; link.click(); URL.revokeObjectURL(url);
  }
  async function file(input: HTMLInputElement) {
    const selected = input.files?.[0]; if (!selected) return;
    if (selected.size > 2_000_000) { registry.notice = 'Datei ist größer als 2 MB.'; return; }
    registry.importText = await selected.text();
  }
  const stateLabel = $derived({ loading: 'Wird geladen', clean: 'Kein Entwurf · aktive Version gilt', editing: 'Offene, nicht gespeicherte Formulareingaben', changed: 'Entwurf geändert · noch nicht geprüft', validated: 'Entwurf geprüft · bereit zur Aktivierung', invalid: 'Entwurf geprüft · Fehler' }[registry.draftState]);
</script>

<div class="changes">
  <HeroStats label="Entwurfsstatus" items={[
    { label: 'Aktive Version', value: registry.activeRevision ?? (store.revision || '—'), hint: registry.view?.registry.used_last_known_good ? 'Last Known Good aktiv' : registry.view?.registry.source ?? '' },
    { label: 'Entwurf', value: registry.changeCount ?? '—', hint: stateLabel, tone: registry.draftState === 'invalid' ? 'danger' : registry.changeCount ? 'warning' : 'neutral' },
    { label: 'Basisversion', value: registry.base || '—', hint: registry.draft ? `Entwurf ${registry.draft.draft_id}` : 'Kein serverseitiger Entwurf' },
    { label: 'Prüfung', value: registry.validation ? (registry.validation.valid ? 'Erfolgreich' : `${registry.validation.errors.length} Fehler`) : '—', tone: registry.validation ? (registry.validation.valid ? 'success' : 'danger') : 'neutral' },
  ]} />

  {#if registry.view?.registry.used_last_known_good}<p class="inline-notice warning">Degradiert: Last Known Good aktiv. Die Datenbank ist derzeit nicht erreichbar; Speichern benötigt das Backend.</p>{/if}
  {#if registry.view?.registry.reason}<p class="inline-notice">Registry-Status: {registry.view.registry.reason}</p>{/if}
  {#if !registry.admin}<p class="inline-notice info">Schreibgeschützt: Entwürfe können nur Administratoren bearbeiten.</p>{/if}

  <section class="panel" aria-labelledby="diff-title">
    <div class="view-head"><div><h2 id="diff-title">Unterschiede zur aktiven Version</h2><p>Jede Zeile ist eine echte Abweichung zwischen aktiver Version und Entwurf, einschließlich offener Dialogeingaben.</p></div>
      {#if registry.admin}<div class="actions"><button type="button" class="secondary" onclick={() => registry.validate()} disabled={registry.busy || !registry.changeCount}>Prüfen</button><button type="button" class="primary" onclick={() => (confirmActivate = true)} disabled={registry.busy || !registry.changeCount || !!registry.fallbackError}>Speichern und aktivieren</button><button type="button" class="secondary" onclick={() => (confirmDiscard = true)} disabled={registry.busy || (!registry.dirty && !registry.draft && !registry.importText)}>Entwurf verwerfen</button></div>{/if}
    </div>
    {#if changes === null}<p class="quiet" aria-live="polite">Der aktive Stand wird geladen. Bis dahin wird keine Änderungsanzahl behauptet.</p>
    {:else if !changes.length}<p class="quiet">Der Entwurf unterscheidet sich nicht von der aktiven Version.</p>
    {:else}
      <div class="table-scroll">
        <table class="data-table static" aria-label="Entwurfs-Diff">
          <thead><tr><th scope="col">Eintrag</th><th scope="col">Feld</th><th scope="col">Vorher</th><th scope="col">Neu</th></tr></thead>
          <tbody>{#each changes as change, index (`${change.kind}:${change.objectId}:${change.field}:${index}`)}<tr><td><span class="cell-main" title={change.objectId}>{change.objectId}</span><span class="secondary-text">{CHANGE_KIND_LABELS[change.kind]} · {CHANGE_ACTION_LABELS[change.action]}</span></td><td>{fieldLabel(change.field)}</td><td class="mono"><span class="cell-main" title={show(change.before)}>{show(change.before)}</span></td><td class="mono"><span class="cell-main" title={show(change.after)}>{show(change.after)}</span></td></tr>{/each}</tbody>
        </table>
      </div>
      {#if impact}
        <div class="impact">
          <h3>Auswirkungen</h3>
          <dl class="kv">
            <div><dt>Betroffene Verträge</dt><dd>{impact.contracts.join(', ') || 'Keine'}</dd></div>
            <div><dt>Betroffene Felder</dt><dd>{impact.fields.join(', ') || 'Keine'}</dd></div>
            <div><dt>Betroffene Verbraucher</dt><dd>{impact.consumers.join(', ') || 'Keine deklarierten Verbraucher'}</dd></div>
            {#if impact.devices.length}<div><dt>Geräte</dt><dd>{impact.devices.join(', ')}</dd></div>{/if}
          </dl>
        </div>
      {/if}
    {/if}
    {#if registry.validation}
      <div class={`inline-notice ${registry.validation.valid ? 'success' : 'danger'}`} role="status">
        <p>{registry.validation.valid ? 'Prüfung erfolgreich. Der Entwurf ist noch nicht gespeichert und nicht aktiv.' : 'Prüfung fehlgeschlagen. Die aktive Version bleibt unverändert.'}</p>
        {#each registry.validation.errors as issue, index (index)}<p>{issue.path ? `${issue.path}: ` : ''}{issue.message}</p>{/each}
      </div>
    {/if}
    {#if registry.error}<p class="inline-notice danger" role="alert">{registry.error.code}: {registry.error.message}{#if registry.error.code === 'revision_conflict'} Eigene Änderungen bleiben erhalten. Der aktive Stand wurde inzwischen geändert; Entwurf verwerfen und erneut vornehmen.{/if}</p>{/if}
  </section>

  {#if registry.admin}
    <section class="panel" aria-labelledby="transfer-title">
      <div class="view-head"><div><h2 id="transfer-title">Import / Export</h2><p>Export enthält nur die aktive Konfiguration des Profils. Import wird geprüft und bleibt ein Entwurf bis zur ausdrücklichen Aktivierung.</p></div></div>
      <div class="actions">
        <button type="button" class="secondary" onclick={() => registry.exportRegistry()} disabled={registry.busy}><Download size={15} aria-hidden="true" /> Aktive Version exportieren</button>
        {#if registry.exportText}<button type="button" class="secondary" onclick={download}>JSON herunterladen</button>{/if}
      </div>
      {#if registry.exportText}<details><summary>Export anzeigen</summary><pre>{registry.exportText}</pre></details>{/if}
      <div class="form-grid">
        <label class="field"><span>JSON-Datei laden</span><input type="file" accept="application/json,.json" onchange={(event) => file(event.currentTarget)} /></label>
        <label class="field span"><span>Import-JSON</span><textarea rows="6" bind:value={registry.importText} spellcheck="false"></textarea></label>
      </div>
      <div class="actions"><button type="button" class="primary" onclick={() => registry.importRegistry()} disabled={registry.busy || registry.dirty || !registry.importText.trim()}><Upload size={15} aria-hidden="true" /> Import prüfen und als Entwurf laden</button></div>
    </section>
  {/if}

  <section class="panel" aria-labelledby="history-title">
    <div class="view-head"><div><h2 id="history-title"><History size={16} aria-hidden="true" /> Versionshistorie</h2><p>Rollback aktiviert eine frühere gültige Version als neue Revision. Der Entwurf muss vorher leer sein.</p></div></div>
    {#if registry.view?.history_error}<p class="inline-notice warning">Historie derzeit nicht verfügbar. Der vorhandene Stand bleibt lesbar.</p>{/if}
    {#if registry.view?.revisions.length}
      <div class="table-scroll">
        <table class="data-table static" aria-label="Versionshistorie">
          <thead><tr><th scope="col" class="col-num">Version</th><th scope="col" class="col-status">Status</th><th scope="col">Erstellt</th><th scope="col" class="col-p2">Quellen · Zusammenführungen · Verträge</th><th scope="col" class="col-actions"><span class="sr-only">Aktionen</span></th></tr></thead>
          <tbody>{#each registry.view.revisions as revision (revision.id)}<tr class:selected={revision.id === registry.view?.registry.revision?.id}><td>{revision.revision}</td><td>{revision.status === 'active' ? 'Aktiv' : revision.status === 'superseded' ? 'Abgelöst' : revision.status}</td><td>{store.when(revision.created_at)}</td><td class="col-p2">{revision.payload?.bindings?.length ?? '—'} · {revision.payload?.fusions?.length ?? '—'} · {revision.payload?.contract_instances?.length ?? '—'}</td><td class="actions">{#if registry.admin && ['active', 'superseded'].includes(revision.status)}<button type="button" class="ghost small" disabled={registry.busy || registry.dirty || revision.id === registry.view?.registry.revision?.id} onclick={() => (rollbackTarget = { id: revision.id, revision: revision.revision })}><RotateCcw size={14} aria-hidden="true" /> Rollback</button>{/if}</td></tr>{/each}</tbody>
        </table>
      </div>
    {:else}<p class="quiet">Noch keine Versionen im Verlauf.</p>{/if}
  </section>
</div>

{#if confirmActivate}
  <ConfirmDialog title="Entwurf speichern und aktivieren?" message={`Der Entwurf mit ${registry.changeCount ?? 0} Änderungen wird erneut geprüft, als neue Version gespeichert und sofort aktiv. Basis ist Version ${registry.base}.`} effects={impact ? [`Betroffene Verträge: ${impact.contracts.join(', ') || 'keine'}`, `Betroffene Verbraucher: ${impact.consumers.join(', ') || 'keine'}`] : []} confirmLabel="Speichern und aktivieren" busy={registry.busy} onConfirm={async () => { confirmActivate = false; await registry.save(); }} onCancel={() => (confirmActivate = false)} />
{/if}
{#if confirmDiscard}
  <ConfirmDialog title="Entwurf verwerfen?" message="Alle Änderungen des Entwurfs gehen verloren. Die aktive Version bleibt unverändert." confirmLabel="Entwurf verwerfen" danger busy={registry.busy} onConfirm={async () => { confirmDiscard = false; await registry.discard(); }} onCancel={() => (confirmDiscard = false)} />
{/if}
{#if rollbackTarget}
  <ConfirmDialog title={`Version ${rollbackTarget.revision} wiederherstellen?`} message={`Die Konfiguration von Version ${rollbackTarget.revision} wird als neue aktive Version übernommen. Die aktuelle Version ${registry.activeRevision ?? '—'} bleibt in der Historie erhalten.`} confirmLabel="Rollback aktivieren" danger busy={registry.busy} onConfirm={async () => { const target = rollbackTarget; rollbackTarget = null; if (target) await registry.rollback(target.id); }} onCancel={() => (rollbackTarget = null)} />
{/if}

<style>
  .changes { display: grid; gap: var(--space-4); }
  .panel { display: grid; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .actions button { display: inline-flex; align-items: center; gap: var(--space-1); }
  .impact h3 { margin: var(--space-2) 0; font-size: 0.8rem; color: var(--color-text-muted); }
  .data-table.static tbody tr { cursor: default; }
  pre { max-height: 320px; overflow: auto; font-size: 0.7rem; white-space: pre-wrap; overflow-wrap: anywhere; }
  textarea { width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.74rem; }
  .view-head h2 { display: inline-flex; align-items: center; gap: var(--space-2); }
</style>
