<script lang="ts">
  import { ArrowRight } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { collectProblems, groupProblems, type ProblemAction } from '../../lib/core-contracts/problems';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';
  import HeroStats from '../../lib/ui/HeroStats.svelte';

  /** Aktuelle Probleme: a running list of findings with a direct follow-up action each. Not a one-time wizard. */
  let { store, onAction }: { store: CoreContractsStore; onAction: (action: ProblemAction) => void } = $props();
  let registry = $derived(store.registry);
  let problems = $derived(collectProblems({ context: store.rowContext, sourceRows: store.sourceRows, deviceRows: store.deviceRows, contracts: store.contracts, diagnostics: store.diagnostics, validation: registry.validation }));
  let groups = $derived(groupProblems(problems));
  let blocked = $derived(problems.filter((item) => item.status === 'blocked').length);
  let degraded = $derived(problems.filter((item) => item.status === 'degraded').length);
  let unconfigured = $derived(problems.filter((item) => item.status === 'not_configured').length);
  let loading = $derived(!registry.view && !store.graph && (registry.busy || store.connectionState === 'loading'));
</script>

<div class="problems">
  <div class="view-head"><div><h2>Aktuelle Probleme</h2><p>Laufende Übersicht aus Diagnose, Registry und Home-Assistant-Zustand. Jeder Fund nennt Status, Grund und betroffene Entität und führt direkt zur Stelle, an der er behoben wird. „Unbekannt“ ist ein neutraler Wert und erscheint hier nur, wenn er auf ein Problem zurückgeht.</p></div><StatusBadge status={store.connectionState === 'connected' ? 'info' : 'unavailable'} label={`Stand ${store.when(store.lastUpdated)}`} /></div>
  <HeroStats label="Problemkennzahlen" items={[
    { label: 'Funde gesamt', value: problems.length },
    { label: 'Blockiert', value: blocked, tone: blocked ? 'danger' : 'neutral' },
    { label: 'Eingeschränkt', value: degraded, tone: degraded ? 'warning' : 'neutral' },
    { label: 'Nicht eingerichtet', value: unconfigured, hint: 'Konfiguration fehlt', tone: unconfigured ? 'info' : 'neutral' },
  ]} />
  {#if loading}
    <p class="quiet" aria-live="polite">Probleme werden ermittelt …</p>
  {:else if registry.error && !registry.view}
    <div class="inline-notice danger" role="alert"><p>{registry.error.message}</p><div class="actions"><button type="button" class="secondary small" onclick={() => registry.refresh()}>Erneut laden</button></div></div>
  {:else if !problems.length}
    <div class="ok"><StatusBadge status="healthy" /><div><h3>Keine aktuellen Probleme</h3><p class="quiet">Alle mit den vorhandenen Daten prüfbaren Quellen, Geräte, Pflichtrollen und Vertragsfelder sind in Ordnung.</p></div></div>
  {:else}
    {#each groups as group (group.kind)}
      <section class="group" aria-labelledby={`group-${group.kind}`}>
        <h3 id={`group-${group.kind}`}>{group.label} <span class="count">{group.items.length}</span></h3>
        <ul>
          {#each group.items as problem (problem.id)}
            <li class="finding">
              <StatusBadge status={problem.status} />
              <div class="body">
                <strong>{problem.title}</strong>
                <span class="reason">{problem.reason}</span>
                <span class="entity"><span class="quiet">{problem.entityKind}:</span> <code>{problem.entity}</code>{#if problem.technical && store.preferences.technicalNames} <span class="tech">{problem.technical}</span>{/if}</span>
              </div>
              <button type="button" class="primary small" onclick={() => onAction(problem.action)}>{problem.actionLabel}<ArrowRight size={14} aria-hidden="true" /></button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<style>
  .problems { display: grid; gap: var(--space-4); }
  .group { display: grid; gap: var(--space-2); }
  .group h3 { margin: 0; font-size: 0.9rem; }
  .count { margin-left: var(--space-1); color: var(--color-text-muted); font-weight: 500; }
  ul { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
  .finding, .ok { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
  .body { display: grid; flex: 1; gap: 2px; min-width: 0; font-size: 0.8rem; }
  .reason { color: var(--color-text-secondary); line-height: 1.4; }
  .entity { font-size: 0.72rem; overflow-wrap: anywhere; }
  .entity code { color: var(--color-text-secondary); }
  .finding button { display: inline-flex; align-items: center; gap: var(--space-1); white-space: nowrap; }
  .ok h3 { margin: 0; font-size: 0.95rem; } .ok p { margin: 2px 0 0; }
  @media (max-width: 680px) { .finding { flex-wrap: wrap; } .finding button { width: 100%; justify-content: center; } }
</style>
