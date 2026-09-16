<script lang="ts">
  import { CheckCircle2, CircleDot, FilePenLine, ShieldCheck } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';

  /**
   * Always visible version and draft status with the explicit draft actions.
   * The backend's draft/save validates, persists and activates atomically, so
   * "Speichern und aktivieren" is one action; there is no separate "save only".
   */
  let { store, onOpenChanges }: { store: CoreContractsStore; onOpenChanges: () => void } = $props();
  let registry = $derived(store.registry);
  let changes = $derived(registry.changeCount);
  let saved = $derived(registry.savedChangeCount);
  let draftState = $derived(registry.draftState);
  let confirmActivate = $state(false);
  let confirmDiscard = $state(false);
  const draftText = $derived(
    draftState === 'loading' ? 'Wird geladen …'
    : draftState === 'clean' ? 'Kein Entwurf'
    : draftState === 'editing' ? `${changes ?? 0} Änderungen · offene Eingaben`
    : draftState === 'validated' ? `${changes} Änderungen · geprüft`
    : draftState === 'invalid' ? `${changes} Änderungen · Prüfung fehlgeschlagen`
    : `${changes} Änderungen`,
  );
  const savedText = $derived(saved === null ? '—' : registry.formDirty ? 'Nicht gespeicherte Eingaben' : registry.draft ? `Im Entwurf gespeichert (Basis ${registry.base})` : 'Nichts zu speichern');
  const validationText = $derived(registry.validation ? (registry.validation.valid ? 'Erfolgreich' : `${registry.validation.errors.length} Fehler`) : registry.changeCount ? 'Ausstehend' : '—');
  async function activate() { confirmActivate = false; await registry.save(); }
  async function discard() { confirmDiscard = false; await registry.discard(); }
</script>

<section class="version-bar" aria-label="Versions- und Entwurfsstatus">
  <div class="facts" aria-live="polite">
    <div class="fact"><CircleDot size={15} aria-hidden="true" /><span>Aktive Version</span><strong>{registry.activeRevision ?? (store.revision || '—')}</strong></div>
    <div class="fact" class:attention={(changes ?? 0) > 0}><FilePenLine size={15} aria-hidden="true" /><span>Entwurf</span><strong>{draftText}</strong></div>
    <div class="fact"><ShieldCheck size={15} aria-hidden="true" /><span>Gespeichert</span><strong>{savedText}</strong></div>
    <div class="fact" class:warn={registry.validation && !registry.validation.valid}><CheckCircle2 size={15} aria-hidden="true" /><span>Prüfung</span><strong>{validationText}</strong></div>
    {#if registry.lastActivatedRevision !== null && registry.lastActivatedRevision === registry.activeRevision && !registry.changeCount}<div class="fact ok"><CheckCircle2 size={15} aria-hidden="true" /><span>Zuletzt</span><strong>Version {registry.lastActivatedRevision} aktiviert</strong></div>{/if}
  </div>
  <div class="actions">
    {#if registry.admin}
      <button type="button" class="secondary small" onclick={() => registry.validate()} disabled={registry.busy || !registry.changeCount || !!registry.fallbackError}>Prüfen</button>
      <button type="button" class="primary small" onclick={() => (confirmActivate = true)} disabled={registry.busy || !registry.changeCount || !!registry.fallbackError}>Speichern und aktivieren</button>
      <button type="button" class="secondary small" onclick={() => (confirmDiscard = true)} disabled={registry.busy || (!registry.dirty && !registry.draft && !registry.importText)}>Entwurf verwerfen</button>
    {/if}
    <button type="button" class="ghost small" onclick={onOpenChanges}>Änderungen öffnen</button>
  </div>
</section>
{#if registry.notice || registry.error}
  <div class="version-notice" role={registry.error ? 'alert' : 'status'}>
    {#if registry.error}<span class="error">{registry.error.code}: {registry.error.message}</span>{#if registry.error.code === 'revision_conflict'}<span> Eigene Änderungen bleiben erhalten. „Aktualisieren“ lädt den aktiven Stand zum Vergleich.</span>{/if}{:else}<span>{registry.notice}</span>{/if}
  </div>
{/if}
{#if confirmActivate}
  <ConfirmDialog title="Entwurf speichern und aktivieren?" message={`Der Entwurf mit ${changes ?? 0} Änderungen wird erneut geprüft, als neue Version gespeichert und sofort aktiv. Basis ist Version ${registry.base}.`} effects={registry.validation?.valid ? ['Die letzte Prüfung war erfolgreich.'] : ['Der Entwurf wurde noch nicht erfolgreich geprüft; die Prüfung läuft beim Speichern erneut.']} confirmLabel="Speichern und aktivieren" busy={registry.busy} onConfirm={activate} onCancel={() => (confirmActivate = false)} />
{/if}
{#if confirmDiscard}
  <ConfirmDialog title="Entwurf verwerfen?" message="Alle Änderungen des Entwurfs gehen verloren. Die aktive Version bleibt unverändert." confirmLabel="Entwurf verwerfen" danger busy={registry.busy} onConfirm={discard} onCancel={() => (confirmDiscard = false)} />
{/if}

<style>
  .version-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); }
  .facts { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
  .fact { display: grid; grid-template-columns: auto auto; align-items: center; gap: 2px var(--space-2); color: var(--color-text-muted); font-size: 0.68rem; }
  .fact strong { grid-column: 2; color: var(--color-text-primary); font-size: 0.76rem; }
  .fact.attention strong { color: var(--color-warning-foreground); }
  .fact.warn strong { color: var(--color-danger-foreground); }
  .fact.ok strong { color: var(--color-success-foreground); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .version-notice { padding: var(--space-2) var(--space-4); color: var(--color-text-secondary); font-size: 0.76rem; }
  .version-notice .error { color: var(--color-danger-foreground); }
  @media (max-width: 700px) { .actions { width: 100%; } .actions button { flex: 1 1 45%; } }
</style>
