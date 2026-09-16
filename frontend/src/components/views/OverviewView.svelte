<script lang="ts">
  import { ArrowRight } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { collectProblems, contractCategories, type ProblemAction } from '../../lib/core-contracts/problems';
  import { labelForSchema } from '../../lib/core-contracts/format';
  import HeroStats from '../../lib/ui/HeroStats.svelte';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';
  import StateBanner from '../../lib/ui/StateBanner.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';

  /** Übersicht: system state with separated key figures and the entry into relevant problems. */
  let { store, onProblems, onProblem, onContract }: { store: CoreContractsStore; onProblems: () => void; onProblem: (action: ProblemAction) => void; onContract: (id: string) => void } = $props();
  let registry = $derived(store.registry);
  let categories = $derived(contractCategories(store.contracts));
  let sourceRows = $derived(store.sourceRows);
  let problems = $derived(collectProblems({ context: store.rowContext, sourceRows, deviceRows: store.deviceRows, contracts: store.contracts, diagnostics: store.diagnostics, validation: registry.validation }));
  let urgent = $derived(problems.filter((item) => item.status === 'blocked').slice(0, 5));
  let healthy = $derived(store.contracts.filter((item) => item.health === 'healthy').length);
</script>

<div class="overview">
  <div class="view-head">
    <div><h2>Systemzustand</h2><p>Was gilt gerade, was ist konfiguriert und was braucht Aufmerksamkeit. Verbindung und Datenqualität sind getrennte Aussagen.</p></div>
    <StateBanner state={store.dataState} />
  </div>
  {#if store.previewMode}<p class="inline-notice warning">Lokale Vorschau-Daten zur UI-Prüfung. In Home Assistant werden ausschließlich reale WebSocket-Daten angezeigt.</p>{/if}

  <h3 class="section-title">Konfiguration</h3>
  <HeroStats label="Konfigurationskennzahlen" items={[
    { label: 'Aktive Version', value: registry.activeRevision ?? (store.revision || '—'), hint: registry.changeCount ? `${registry.changeCount} Änderungen im Entwurf` : 'Kein Entwurf' },
    { label: 'Verträge', value: store.contracts.length, hint: `${healthy} gesund` },
    { label: 'Quellen', value: sourceRows.length, hint: `${sourceRows.filter((row) => row.binding.enabled !== false).length} aktiv` },
    { label: 'Geräte', value: registry.devices.length, hint: `${registry.devices.filter((item) => item.liveness_entity).length} mit Lebenszeichen` },
    { label: 'Quellen mit Gerät', value: sourceRows.filter((row) => row.binding.device_id).length, hint: `${sourceRows.filter((row) => !row.binding.device_id).length} ohne Gerätebezug` },
  ]} />

  <h3 class="section-title">Qualität und Nutzbarkeit</h3>
  <HeroStats label="Qualitätskennzahlen" items={[
    { label: 'Wert unbekannt', value: categories.unknown.length, hint: 'neutrale Information, kein Fehler', tone: 'info' },
    { label: 'Eingeschränkt', value: categories.degraded.length, hint: 'verwendbar mit Einschränkung', tone: categories.degraded.length ? 'warning' : 'neutral' },
    { label: 'Blockiert', value: categories.blocked.length, hint: 'für Verbraucher nicht nutzbar', tone: categories.blocked.length ? 'danger' : 'neutral' },
    { label: 'Aktuelle Probleme', value: problems.length, hint: `${problems.filter((item) => item.status === 'blocked').length} blockierend`, tone: problems.length ? 'warning' : 'success' },
  ]} />
  {#if categories.overlap.length}
    <p class="inline-notice info">{categories.overlap.length === 1 ? 'Ein Vertrag' : `${categories.overlap.length} Verträge`} ({categories.overlap.join(', ')}) erscheint sowohl unter „Wert unbekannt“ als auch unter „Eingeschränkt/Blockiert“: Der unbekannte Wert ist dort die Folge der Einschränkung, nicht ein zweiter Fehler.</p>
  {/if}

  {#if !store.contracts.length}
    <EmptyState title="Noch keine Core Contracts" message={store.connectionState === 'connected' ? 'Die Verbindung steht, aber es sind keine Vertragsinstanzen veröffentlicht. Legen Sie unter Verträge einen Vertrag und unter Quellen seine Zusammenführungen an.' : 'Sobald die Verbindung steht, erscheinen hier die Verträge.'} />
  {:else}
    <div class="columns">
      <section class="panel" aria-labelledby="urgent-title">
        <div class="view-head"><h3 id="urgent-title">Braucht Aufmerksamkeit</h3><button type="button" class="ghost small" onclick={onProblems}>Alle Probleme <ArrowRight size={14} aria-hidden="true" /></button></div>
        {#if urgent.length}
          <ul>{#each urgent as problem (problem.id)}<li><StatusBadge status={problem.status} /><div><strong>{problem.title}</strong><span class="quiet">{problem.reason}</span></div><button type="button" class="secondary small" onclick={() => onProblem(problem.action)}>{problem.actionLabel}</button></li>{/each}</ul>
        {:else if problems.length}
          <p class="quiet">Keine blockierenden Funde. {problems.length} weitere Hinweise unter „Aktuelle Probleme“.</p>
        {:else}
          <p class="quiet">Keine aktuellen Probleme.</p>
        {/if}
      </section>
      <section class="panel" aria-labelledby="contracts-title">
        <div class="view-head"><h3 id="contracts-title">Verträge</h3></div>
        <ul>{#each store.contracts as contract (contract.contract_id)}<li><StatusBadge status={contract.health} /><div><strong>{contract.contract_id}</strong><span class="quiet">{labelForSchema(contract.schema_id)} · {Object.values(contract.field_states).filter((state) => state === 'unknown').length} von {Object.keys(contract.values).length} Feldern unbekannt</span></div><button type="button" class="ghost small" onclick={() => onContract(contract.contract_id)}>Öffnen</button></li>{/each}</ul>
      </section>
    </div>
  {/if}
</div>

<style>
  .overview { display: grid; gap: var(--space-4); }
  .section-title { margin: var(--space-2) 0 calc(-1 * var(--space-2)); color: var(--color-text-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); align-items: start; }
  .panel { display: grid; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
  .panel h3 { margin: 0; font-size: 0.95rem; }
  ul { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
  li { display: flex; align-items: center; gap: var(--space-3); min-height: 44px; }
  li div { display: grid; flex: 1; gap: 1px; min-width: 0; font-size: 0.8rem; }
  li .quiet { font-size: 0.72rem; overflow-wrap: anywhere; }
  .ghost.small { display: inline-flex; align-items: center; gap: var(--space-1); }
  @media (max-width: 1000px) { .columns { grid-template-columns: 1fr; } }
</style>
