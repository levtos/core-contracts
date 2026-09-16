<script lang="ts">
  import { ArrowDownUp, Plus, Search, X } from '@lucide/svelte';
  import type { ListFilter } from '../../lib/core-contracts/listing';
  import { CADENCE_LABELS } from '../../lib/core-contracts/labels';

  /** Search, sort and effective filters for one list. State lives in the owner. */
  let {
    filter,
    onChange,
    sortOptions,
    domains = [],
    deviceTypes = [],
    showStatus = true,
    showDomain = true,
    showType = false,
    showCadence = false,
    showNotConfigured = true,
    total,
    shown,
    searchLabel = 'Suchen nach Name oder Entity-ID',
    addLabel = '',
    onAdd,
    ids = 'list',
  }: {
    filter: ListFilter;
    onChange: (next: ListFilter) => void;
    sortOptions: { value: string; label: string }[];
    domains?: string[];
    deviceTypes?: string[];
    showStatus?: boolean;
    showDomain?: boolean;
    showType?: boolean;
    showCadence?: boolean;
    showNotConfigured?: boolean;
    total: number;
    shown: number;
    searchLabel?: string;
    addLabel?: string;
    onAdd?: () => void;
    ids?: string;
  } = $props();

  const update = (patch: Partial<ListFilter>) => onChange({ ...filter, ...patch });
  let active = $derived(Boolean(filter.query) || filter.status !== 'all' || filter.domain !== 'all' || filter.deviceType !== 'all' || filter.cadence !== 'all');
</script>

<div class="list-toolbar" role="search" aria-label="Liste durchsuchen und filtern">
  <label class="search">
    <Search size={16} aria-hidden="true" />
    <span class="sr-only">{searchLabel}</span>
    <input type="search" id={`${ids}-search`} placeholder={searchLabel} value={filter.query} oninput={(event) => update({ query: event.currentTarget.value })} />
    {#if filter.query}<button type="button" class="ghost icon small" aria-label="Suche leeren" onclick={() => update({ query: '' })}><X size={14} aria-hidden="true" /></button>{/if}
  </label>
  {#if showStatus}
    <label class="control">
      <span>Qualitätsstatus</span>
      <select id={`${ids}-status`} value={filter.status} onchange={(event) => update({ status: event.currentTarget.value as ListFilter['status'] })}>
        <option value="all">Alle</option>
        <option value="healthy">Gesund</option>
        <option value="degraded">Eingeschränkt</option>
        <option value="blocked">Blockiert</option>
        <option value="unknown">Unbekannt (neutraler Wert)</option>
        {#if showNotConfigured}<option value="not_configured">Konfiguration: nicht eingerichtet / deaktiviert</option>{/if}
      </select>
    </label>
  {/if}
  {#if showDomain}
    <label class="control">
      <span>Domäne</span>
      <select id={`${ids}-domain`} value={filter.domain} onchange={(event) => update({ domain: event.currentTarget.value })}>
        <option value="all">Alle</option>
        {#each domains as domain (domain)}<option value={domain}>{domain}</option>{/each}
      </select>
    </label>
  {/if}
  {#if showType}
    <label class="control">
      <span>Gerätetyp / Label</span>
      <select id={`${ids}-type`} value={filter.deviceType} onchange={(event) => update({ deviceType: event.currentTarget.value })}>
        <option value="all">Alle</option>
        {#each deviceTypes as type (type)}<option value={type}>{type}</option>{/each}
      </select>
    </label>
  {/if}
  {#if showCadence}
    <label class="control">
      <span>Kadenz</span>
      <select id={`${ids}-cadence`} value={filter.cadence} onchange={(event) => update({ cadence: event.currentTarget.value as ListFilter['cadence'] })}>
        <option value="all">Alle</option>
        {#each Object.entries(CADENCE_LABELS) as [value, label] (value)}<option {value}>{label}</option>{/each}
      </select>
    </label>
  {/if}
  <label class="control">
    <span>Sortierung</span>
    <span class="sort">
      <select id={`${ids}-sort`} value={filter.sort} onchange={(event) => update({ sort: event.currentTarget.value })}>
        {#each sortOptions as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
      </select>
      <button type="button" class="ghost icon" aria-label={filter.direction === 'asc' ? 'Aufsteigend sortiert, auf absteigend wechseln' : 'Absteigend sortiert, auf aufsteigend wechseln'} aria-pressed={filter.direction === 'desc'} onclick={() => update({ direction: filter.direction === 'asc' ? 'desc' : 'asc' })}><ArrowDownUp size={16} aria-hidden="true" /></button>
    </span>
  </label>
  <div class="summary" aria-live="polite">
    <span>{shown} von {total}</span>
    {#if active}<button type="button" class="ghost small" onclick={() => onChange({ ...filter, query: '', status: 'all', domain: 'all', deviceType: 'all', cadence: 'all' })}>Filter zurücksetzen</button>{/if}
  </div>
  {#if onAdd && addLabel}<button type="button" class="primary add" onclick={onAdd}><Plus size={16} aria-hidden="true" />{addLabel}</button>{/if}
</div>

<style>
  .list-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-2) var(--space-3); }
  .search { display: flex; flex: 1 1 240px; align-items: center; gap: var(--space-2); min-height: 44px; padding: 0 var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-background); color: var(--color-text-muted); }
  .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--color-text-primary); }
  .search:focus-within { border-color: var(--color-info); }
  .control { display: grid; gap: 4px; color: var(--color-text-muted); font-size: 0.7rem; }
  .control select { min-width: 140px; }
  .sort { display: flex; gap: var(--space-1); }
  .summary { display: flex; align-items: center; gap: var(--space-2); min-height: 44px; color: var(--color-text-muted); font-size: 0.74rem; }
  .add { display: inline-flex; align-items: center; gap: var(--space-2); margin-left: auto; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (max-width: 700px) { .control, .control select, .add { width: 100%; } .add { margin-left: 0; justify-content: center; } }
</style>
