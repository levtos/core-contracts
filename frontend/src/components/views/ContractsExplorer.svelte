<script lang="ts">
  import { ExternalLink, HelpCircle, Pencil, Trash2, X } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { applyFilter, countByHealth, distinct, healthRank, sortRows, type ContractRow } from '../../lib/core-contracts/listing';
  import { formatValue, labelForSchema } from '../../lib/core-contracts/format';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import HeroStats from '../../lib/ui/HeroStats.svelte';
  import ListToolbar from '../../lib/ui/ListToolbar.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';

  /** Verträge: table left, inspector right, pencil for the full contract dialog. */
  let { store, onSelect, onDetail, onTrace }: { store: CoreContractsStore; onSelect: (id: string) => void; onDetail: (id: string) => void; onTrace: (id: string, field: string) => void } = $props();
  let registry = $derived(store.registry);
  let admin = $derived(registry.admin);
  let rows = $derived(store.contractRows);
  let counts = $derived(countByHealth(rows));
  let domains = $derived(distinct(rows.flatMap((row) => row.domain.split(','))));
  let visible = $derived(sortRows(applyFilter(rows, store.contractFilter, (row) => `${row.name} ${row.schema} ${labelForSchema(row.schema)} ${row.consumers.join(' ')}`), store.contractFilter, {
    name: (row) => row.name, schema: (row) => row.schema, status: (row) => healthRank(row.health), freshness: (row) => row.freshness, unknown: (row) => row.unknownFields, consumers: (row) => row.consumers.length,
  }));
  let selected = $derived(store.selectedContract);
  let selectedRow = $derived(rows.find((row) => row.id === store.selectedContractId) ?? null);
  let selectedInstance = $derived(registry.instances.find((item) => item.contract_id === store.selectedContractId) ?? null);
  let removeTarget = $state<ContractRow | null>(null);
  const sortOptions = [{ value: 'name', label: 'Name' }, { value: 'schema', label: 'Schema' }, { value: 'status', label: 'Qualität' }, { value: 'freshness', label: 'Frische' }, { value: 'unknown', label: 'Unbekannte Felder' }, { value: 'consumers', label: 'Verbraucher' }];
  const open = (id: string) => (store.preferences.openBehavior === 'detail' ? onDetail(id) : onSelect(id));
  const rowKey = (event: KeyboardEvent, action: () => void) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
  const instanceFor = (id: string) => registry.instances.find((item) => item.contract_id === id) ?? null;
  const headline = (row: ContractRow) => { const field = Object.keys(row.contract.values)[0]; return field ? `${field}: ${formatValue(row.contract.values[field])}` : '—'; };
</script>

<div class="contracts">
  <HeroStats label="Kennzahlen Verträge" items={[
    { label: 'Aktive Version', value: registry.activeRevision ?? (store.revision || '—') },
    { label: 'Verträge', value: rows.length, hint: `${registry.instances.length} konfiguriert` },
    { label: 'Gesund', value: counts.healthy, tone: 'success' },
    { label: 'Eingeschränkt / blockiert', value: counts.degraded + counts.blocked, hint: `${counts.degraded} eingeschränkt · ${counts.blocked} blockiert`, tone: counts.blocked ? 'danger' : counts.degraded ? 'warning' : 'neutral' },
    { label: 'Unbekannt', value: counts.unknown, hint: 'neutraler Wert, kein Fehler', tone: 'info' },
  ]} />
  <div class={`list-layout ${selected && store.preferences.openBehavior === 'inspector' ? '' : 'no-inspector'}`}>
    <section class="list-panel" aria-label="Vertrags-Explorer">
      <ListToolbar ids="contracts" filter={store.contractFilter} onChange={(next) => (store.contractFilter = next)} sortOptions={sortOptions} domains={domains} showNotConfigured={false} total={rows.length} shown={visible.length} searchLabel="Suchen nach Vertrag, Schema oder Verbraucher" addLabel={admin ? 'Vertrag hinzufügen' : ''} onAdd={admin ? () => registry.selectInstance(null) : undefined} />
      {#if !rows.length}
        <EmptyState title="Keine Verträge" message={admin ? 'Legen Sie über „Vertrag hinzufügen“ eine Vertragsinstanz an und verbinden Sie ihre Felder unter Quellen → Zusammenführungen.' : 'Im aktuellen Profil sind keine Verträge veröffentlicht.'} />
      {:else if !visible.length}
        <EmptyState title="Kein Treffer" message="Kein Vertrag passt zu Suche und Filtern." />
      {:else}
        <div class="table-scroll">
          <table class="data-table" aria-label="Verträge">
            <thead><tr><th scope="col">Name</th><th scope="col" class="col-p2">Wert</th><th scope="col" class="col-status">Qualität</th><th scope="col" class="col-status col-p3">Frische</th><th scope="col" class="col-num col-p3">Unbekannt</th><th scope="col" class="col-p3">Verbraucher</th><th scope="col" class="col-actions"><span class="sr-only">Aktionen</span></th></tr></thead>
            <tbody>
              {#each visible as row (row.id)}
                <tr class:selected={store.selectedContractId === row.id} tabindex="0" aria-selected={store.selectedContractId === row.id} onclick={() => open(row.id)} onkeydown={(event) => rowKey(event, () => open(row.id))}>
                  <td><span class="cell-main" title={row.name}>{String(instanceFor(row.id)?.display_name ?? '') || row.name}</span><span class="secondary-text">{labelForSchema(row.schema)}{store.preferences.technicalNames || String(instanceFor(row.id)?.display_name ?? '') ? ` · ${row.name}` : ''}</span></td>
                  <td class="col-p2"><span class="cell-main" title={headline(row)}>{headline(row)}</span></td>
                  <td class="col-status"><StatusBadge status={row.health} /></td>
                  <td class="col-status col-p3"><StatusBadge status={row.freshness} /></td>
                  <td class="col-num col-p3">{row.unknownFields} / {row.fields}</td>
                  <td class="col-p3"><span class="cell-main" title={row.consumers.join(', ')}>{row.consumers.join(', ') || '—'}</span></td>
                  <td class="actions">{#if admin && instanceFor(row.id)}<button type="button" class="ghost icon" aria-label={`Vertrag ${row.name} bearbeiten`} onclick={(event) => { event.stopPropagation(); onSelect(row.id); registry.selectInstance(instanceFor(row.id)); }}><Pencil size={16} aria-hidden="true" /></button>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      {#if admin}
        {@const orphans = registry.instances.filter((item) => !rows.some((row) => row.id === item.contract_id))}
        {#if orphans.length}
          <div class="inline-notice info"><p><strong>Konfiguriert, aber noch nicht berechnet:</strong> {orphans.map((item) => String(item.display_name ?? item.contract_id)).join(', ')}. {registry.draft ? 'Diese Verträge liegen im Entwurf und erscheinen nach der Aktivierung.' : 'Die Laufzeit hat diese Verträge noch nicht ausgewertet.'}</p><div class="actions">{#each orphans as item (String(item.contract_id))}<button type="button" class="secondary small" onclick={() => registry.selectInstance(item)}><Pencil size={13} aria-hidden="true" /> {String(item.display_name ?? item.contract_id)}</button>{/each}</div></div>
        {/if}
      {/if}
    </section>
    {#if selected && store.preferences.openBehavior === 'inspector'}
      <aside class="inspector" aria-label="Vertrags-Inspector">
        <div class="inspector-head"><div><small class="quiet">{labelForSchema(selected.schema_id)} · Schema v{selected.schema_version}</small><h2>{String(selectedInstance?.display_name ?? '') || selected.contract_id}</h2>{#if selectedInstance?.display_name || store.preferences.technicalNames}<span class="tech">{selected.contract_id}</span>{/if}</div><button type="button" class="ghost icon" aria-label="Inspector schließen" onclick={() => (store.selectedContractId = null)}><X size={18} aria-hidden="true" /></button></div>
        <div class="badges"><StatusBadge status={selected.health} />{#if selectedRow}<StatusBadge status={selectedRow.freshness} />{/if}</div>
        <p class="quiet">Stand {store.when(selected.generated_at)}</p>
        <h3>Felder</h3>
        <div class="fields">
          {#each Object.entries(selected.values) as [field, value] (field)}
            <div class="field-row"><div><span class="quiet">{field}</span><strong>{formatValue(value)}</strong></div><div class="badges"><StatusBadge status={selected.field_quality[field]?.health ?? 'unknown'} /></div><button type="button" class="link" onclick={() => onTrace(selected.contract_id, field)}><HelpCircle size={14} aria-hidden="true" />Warum?</button></div>
          {/each}
        </div>
        <h3>Quellen</h3>
        <p class="quiet">{[...new Set(Object.values(selected.lineage).flat())].join(', ') || 'Keine aktive Quelle'}</p>
        <h3>Verbraucher</h3>
        <p class="quiet">{selectedRow?.consumers.join(', ') || 'Keine deklarierten Verbraucher'}</p>
        <div class="actions">
          <button type="button" class="primary" onclick={() => onDetail(selected.contract_id)}><ExternalLink size={15} aria-hidden="true" /> Vollständig öffnen</button>
          {#if admin && selectedInstance}<button type="button" class="secondary" onclick={() => registry.selectInstance(selectedInstance)}><Pencil size={15} aria-hidden="true" /> Bearbeiten</button>{/if}
          {#if admin && selectedInstance && selectedRow}<button type="button" class="secondary" onclick={() => (removeTarget = selectedRow)}><Trash2 size={15} aria-hidden="true" /> Löschen</button>{/if}
        </div>
      </aside>
    {/if}
  </div>
</div>

{#if removeTarget}
  <ConfirmDialog title={`Vertrag „${removeTarget.name}“ löschen?`} message="Die Vertragsinstanz wird aus dem Entwurf entfernt. Referenzierte Instanzen werden vom Backend geschützt." effects={[`Zusammenführungen: ${store.rowContext.fusions.filter((fusion) => fusion.contract_id === removeTarget?.id).length}`, `Betroffene Verbraucher: ${removeTarget.consumers.join(', ') || 'keine'}`]} confirmLabel="Löschen" danger busy={registry.busy} onConfirm={async () => { const target = removeTarget; removeTarget = null; const instance = target ? instanceFor(target.id) : null; if (instance) await registry.removeInstance(instance); }} onCancel={() => (removeTarget = null)} />
{/if}

<style>
  .contracts { display: grid; gap: var(--space-4); }
  .fields { display: grid; gap: var(--space-2); }
  .field-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); }
  .field-row > div:first-child { display: grid; gap: 1px; min-width: 0; font-size: 0.8rem; }
  .field-row strong { overflow-wrap: anywhere; }
  .actions button { display: inline-flex; align-items: center; gap: var(--space-1); }
</style>
