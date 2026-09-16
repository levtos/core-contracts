<script lang="ts">
  import { Pencil, Trash2, X } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { applyFilter, countByHealth, distinct, healthRank, sortRows, type DeviceRow } from '../../lib/core-contracts/listing';
  import { LIVENESS_LABELS, labelForCadence } from '../../lib/core-contracts/labels';
  import { formatDuration } from '../../lib/core-contracts/format';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import HeroStats from '../../lib/ui/HeroStats.svelte';
  import ListToolbar from '../../lib/ui/ListToolbar.svelte';
  import EntityId from '../../lib/ui/EntityId.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';

  /** Geräte: confirmed device inventory with cadence, liveness and assigned sources. */
  let { store, onSource }: { store: CoreContractsStore; onSource: (bindingId: string) => void } = $props();
  let registry = $derived(store.registry);
  let admin = $derived(registry.admin);
  let rows = $derived(store.deviceRows);
  let counts = $derived(countByHealth(rows));
  let types = $derived(distinct(rows.map((row) => row.deviceType)));
  let visible = $derived(sortRows(applyFilter(rows.map((row) => ({ ...row, domain: distinct(row.sources.map((source) => source.domain)).join(',') })), store.deviceFilter, (row) => `${row.info.name} ${row.info.model ?? ''} ${row.info.manufacturer ?? ''} ${row.id} ${row.livenessEntity ?? ''} ${row.sources.map((source) => `${source.name} ${source.entityId}`).join(' ')}`), store.deviceFilter, {
    name: (row) => row.info.name, cadence: (row) => row.cadence, liveness: (row) => row.livenessStatus, sources: (row) => row.sources.length, status: (row) => healthRank(row.health),
  }));
  let selected = $derived(rows.find((row) => row.id === store.selectedDeviceId) ?? null);
  let removeTarget = $state<DeviceRow | null>(null);
  const sortOptions = [{ value: 'name', label: 'Name' }, { value: 'cadence', label: 'Kadenz' }, { value: 'liveness', label: 'Lebenszeichen' }, { value: 'sources', label: 'Anzahl Quellen' }, { value: 'status', label: 'Status' }];
  const rowKey = (event: KeyboardEvent, action: () => void) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
  const livenessBadge = (row: DeviceRow) => row.livenessEntity ? row.livenessStatus : 'not_configured';
</script>

<div class="devices">
  <HeroStats label="Kennzahlen Geräte" items={[
    { label: 'Aktive Version', value: registry.activeRevision ?? (store.revision || '—') },
    { label: 'Geräte', value: rows.length, hint: `${rows.filter((row) => row.livenessEntity).length} mit Lebenszeichenquelle` },
    { label: 'Gesund', value: counts.healthy, tone: 'success' },
    { label: 'Eingeschränkt / blockiert', value: counts.degraded + counts.blocked, hint: `${counts.degraded} eingeschränkt · ${counts.blocked} blockiert`, tone: counts.blocked ? 'danger' : counts.degraded ? 'warning' : 'neutral' },
    { label: 'Ohne Lebenszeichen', value: rows.filter((row) => !row.livenessEntity).length, hint: 'Konfiguration, kein Qualitätsurteil', tone: 'info' },
  ]} />
  <div class={`list-layout ${selected ? '' : 'no-inspector'}`}>
    <div class="list-panel">
      <ListToolbar ids="devices" filter={store.deviceFilter} onChange={(next) => (store.deviceFilter = next)} sortOptions={sortOptions} deviceTypes={types} showType showCadence showNotConfigured={false} total={rows.length} shown={visible.length} searchLabel="Suchen nach Gerät, Modell oder Entity" />
      {#if !rows.length}
        <EmptyState title="Noch keine bestätigten Geräte" message="Geräte entstehen, wenn Sie beim Bearbeiten einer Quelle einen Gerätevorschlag ausdrücklich bestätigen. Es gibt keine automatische Zuordnung." />
      {:else if !visible.length}
        <EmptyState title="Kein Treffer" message="Kein Gerät passt zu Suche und Filtern." />
      {:else}
        <div class="table-scroll">
          <table class="data-table" aria-label="Geräte">
            <thead><tr><th scope="col">Gerät</th><th scope="col" class="col-p2">Meldeverhalten</th><th scope="col" class="col-p3">Intervall</th><th scope="col">Lebenszeichen</th><th scope="col" class="col-num">Quellen</th><th scope="col" class="col-status">Status</th><th scope="col" class="col-actions"><span class="sr-only">Aktionen</span></th></tr></thead>
            <tbody>
              {#each visible as row (row.id)}
                <tr class:selected={store.selectedDeviceId === row.id} tabindex="0" aria-selected={store.selectedDeviceId === row.id} onclick={() => (store.selectedDeviceId = row.id)} onkeydown={(event) => rowKey(event, () => (store.selectedDeviceId = row.id))}>
                  <td><span class="cell-main" title={row.info.name}>{row.info.name}</span><span class="secondary-text">{[row.info.manufacturer, row.info.model].filter(Boolean).join(' ') || (store.preferences.technicalNames ? row.id : 'Home-Assistant-Gerät')}</span></td>
                  <td class="col-p2"><span class="cell-main">{labelForCadence(row.cadence)}</span><span class="secondary-text">{row.provenance}</span></td>
                  <td class="col-p3">{formatDuration(row.expectedInterval)}</td>
                  <td>{#if row.livenessEntity}<EntityId id={row.livenessEntity} stacked={false} copyable={false} /><span class="secondary-text">{LIVENESS_LABELS[row.livenessStatus] ?? row.livenessStatus}</span>{:else}<span class="quiet">Nicht festgelegt</span>{/if}</td>
                  <td>{row.sources.length}</td>
                  <td class="col-status"><StatusBadge status={row.health} /></td>
                  <td class="actions">{#if admin}<button type="button" class="ghost icon" aria-label={`Gerät ${row.info.name} bearbeiten`} onclick={(event) => { event.stopPropagation(); store.selectedDeviceId = row.id; registry.selectDevice(row.device); }}><Pencil size={16} aria-hidden="true" /></button>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
    {#if selected}
      {@const row = selected}
      <aside class="inspector" aria-label="Geräte-Inspector">
        <div class="inspector-head"><div><h2>{row.info.name}</h2><span class="quiet">{[row.info.manufacturer, row.info.model].filter(Boolean).join(' ')}</span>{#if store.preferences.technicalNames}<br /><span class="tech">{row.id}</span>{/if}</div><button type="button" class="ghost icon" aria-label="Inspector schließen" onclick={() => (store.selectedDeviceId = null)}><X size={18} aria-hidden="true" /></button></div>
        <div class="badges"><StatusBadge status={row.health} /><StatusBadge status={livenessBadge(row)} label={row.livenessEntity ? `Lebenszeichen: ${LIVENESS_LABELS[row.livenessStatus] ?? row.livenessStatus}` : 'Lebenszeichen nicht festgelegt'} /></div>
        <h3>Geräteinformationen</h3>
        <dl class="kv">
          <div><dt>Meldeverhalten</dt><dd>{labelForCadence(row.cadence)} <span class="quiet">· {row.provenance}</span></dd></div>
          <div><dt>Erwartetes Intervall</dt><dd>{formatDuration(row.expectedInterval)}</dd></div>
          <div><dt>Lebenszeichenquelle</dt><dd>{row.livenessEntity ?? 'nicht festgelegt'}{#if row.livenessState} <span class="quiet">· zuletzt {store.when(row.livenessState)}</span>{/if}</dd></div>
          {#if row.info.labels.length}<div><dt>HA-Labels</dt><dd>{row.info.labels.join(', ')}</dd></div>{/if}
        </dl>
        <h3>Zugeordnete Quellen</h3>
        {#if row.sources.length}
          <ul class="sources">{#each row.sources as source (source.id)}<li><button type="button" class="link" onclick={() => onSource(source.id)}>{source.name}</button><span class="quiet">{source.entityId}{source.cadence.source === 'binding_override' ? ' · überschreibt Gerätewerte' : ''}</span></li>{/each}</ul>
        {:else}<p class="quiet">Keine Quelle verwendet dieses Gerät.</p>{/if}
        {#if admin}
          <div class="actions">
            <button type="button" class="primary" onclick={() => registry.selectDevice(row.device)}><Pencil size={15} aria-hidden="true" /> Bearbeiten</button>
            <button type="button" class="secondary" onclick={() => (removeTarget = row)}><Trash2 size={15} aria-hidden="true" /> Gerät entfernen</button>
          </div>
        {/if}
      </aside>
    {/if}
  </div>
</div>

{#if removeTarget}
  <ConfirmDialog title={`Gerät „${removeTarget.info.name}“ entfernen?`} message="Die bestätigten Gerätewerte werden aus dem Entwurf entfernt. Zugeordnete Quellen fallen auf Legacy-Verhalten ohne Kadenz und Lebenszeichen zurück." effects={removeTarget.sources.length ? removeTarget.sources.map((source) => `Quelle ${source.name} (${source.entityId}) verliert den Gerätebezug`) : ['Keine Quelle verwendet dieses Gerät.']} confirmLabel="Gerät entfernen" danger busy={registry.busy} onConfirm={async () => { const target = removeTarget; removeTarget = null; if (target) { await registry.removeDevice(target.device); if (store.selectedDeviceId === target.id) store.selectedDeviceId = null; } }} onCancel={() => (removeTarget = null)} />
{/if}

<style>
  .devices { display: grid; gap: var(--space-4); }
  .sources { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; font-size: 0.78rem; }
  .sources li { display: grid; gap: 1px; }
</style>
