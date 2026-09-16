<script lang="ts">
  import { HelpCircle, Pencil, Power, Trash2, X } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { applyFilter, countByHealth, distinct, healthRank, sortRows, type FusionRow, type SourceRow } from '../../lib/core-contracts/listing';
  import { CONFIG_STATE_LABELS, HEALTH_LABELS, LIVENESS_LABELS, STRATEGY_HELP, labelForCadence, labelForCadenceSource, labelForReason, labelForStrategy } from '../../lib/core-contracts/labels';
  import { formatDuration } from '../../lib/core-contracts/format';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import HeroStats from '../../lib/ui/HeroStats.svelte';
  import ListToolbar from '../../lib/ui/ListToolbar.svelte';
  import EntityId from '../../lib/ui/EntityId.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';

  let { store, onTrace }: { store: CoreContractsStore; onTrace: (contractId: string, field: string) => void } = $props();
  let registry = $derived(store.registry);
  let admin = $derived(registry.admin);
  let activeRevision = $derived(registry.activeRevision ?? store.revision ?? null);
  let loading = $derived(!registry.view && !store.graph && (registry.busy || store.connectionState === 'loading'));

  // ---- Quellenzuordnungen ----
  let sourceRows = $derived(store.sourceRows);
  let sourceCounts = $derived(countByHealth(sourceRows));
  let sourceDomains = $derived(distinct(sourceRows.map((row) => row.domain)));
  let sourceTypes = $derived(distinct(sourceRows.map((row) => row.deviceType)));
  let visibleSources = $derived(sortRows(applyFilter(sourceRows, store.sourceFilter, (row) => `${row.name} ${row.entityId} ${row.entityName} ${row.role} ${row.capability} ${row.device?.name ?? ''} ${row.binding.binding_id}`), store.sourceFilter, {
    name: (row) => row.name, entity: (row) => row.entityId, role: (row) => row.role, status: (row) => healthRank(row.health), freshness: (row) => row.freshness, device: (row) => row.device?.name ?? '', cadence: (row) => row.cadence.cadence,
  }));
  let selectedSource = $derived(sourceRows.find((row) => row.id === store.selectedBindingId) ?? null);
  const sourceSort = [{ value: 'name', label: 'Name' }, { value: 'entity', label: 'Entity-ID' }, { value: 'role', label: 'Rolle' }, { value: 'status', label: 'Status' }, { value: 'freshness', label: 'Frische' }, { value: 'device', label: 'Gerät' }, { value: 'cadence', label: 'Kadenz' }];

  // ---- Zusammenführungen ----
  let fusionRows = $derived(store.fusionRows);
  let fusionCounts = $derived(countByHealth(fusionRows));
  let visibleFusions = $derived(sortRows(applyFilter(fusionRows, store.fusionFilter, (row) => `${row.name} ${row.strategy} ${labelForStrategy(row.strategy)} ${row.fusion.fusion_id} ${row.inputs.map((item) => item.label).join(' ')}`), store.fusionFilter, {
    name: (row) => row.name, strategy: (row) => labelForStrategy(row.strategy), status: (row) => healthRank(row.health), inputs: (row) => row.inputs.length,
  }));
  let selectedFusion = $derived(fusionRows.find((row) => row.id === store.selectedFusionId) ?? null);
  const fusionSort = [{ value: 'name', label: 'Name' }, { value: 'strategy', label: 'Strategie' }, { value: 'status', label: 'Status' }, { value: 'inputs', label: 'Anzahl Eingänge' }];

  // ---- Bestätigungen ----
  let confirm = $state<{ kind: 'toggle' | 'delete' | 'deleteFusion'; row: SourceRow | FusionRow } | null>(null);
  function effectsFor(row: SourceRow): string[] {
    const effects = [] as string[];
    if (row.contracts.length) effects.push(`Betroffene Verträge: ${row.contracts.join(', ')}`); else effects.push('Kein Vertrag verwendet diese Quelle.');
    if (row.consumers.length) effects.push(`Betroffene Verbraucher: ${row.consumers.join(', ')}`);
    if (row.binding.required) effects.push('Die Quelle ist als Pflichtquelle markiert. Ohne sie kann das Vertragsfeld blockiert werden.');
    return effects;
  }
  async function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === 'toggle') await registry.toggle((confirm.row as SourceRow).binding);
    if (confirm.kind === 'delete') { await registry.remove((confirm.row as SourceRow).binding); if (store.selectedBindingId === confirm.row.id) store.selectedBindingId = null; }
    if (confirm.kind === 'deleteFusion') { await registry.removeFusion((confirm.row as FusionRow).fusion); if (store.selectedFusionId === confirm.row.id) store.selectedFusionId = null; }
    if (!registry.error) confirm = null;
  }
  const rowKey = (event: KeyboardEvent, action: () => void) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
  const lastValue = (entityId: string) => registry.hass?.states?.[entityId]?.state ?? null;
</script>

<div class="sources">
  <div class="tabs" role="tablist" aria-label="Quellen-Unteransichten">
    <button type="button" role="tab" id="tab-bindings" aria-selected={store.sourceTab === 'bindings'} aria-controls="panel-bindings" onclick={() => (store.sourceTab = 'bindings')}>Quellenzuordnungen <b>{sourceRows.length}</b></button>
    <button type="button" role="tab" id="tab-fusions" aria-selected={store.sourceTab === 'fusions'} aria-controls="panel-fusions" onclick={() => (store.sourceTab = 'fusions')}>Zusammenführungen <b>{fusionRows.length}</b></button>
  </div>

  {#if loading}
    <p class="quiet" aria-live="polite">Quellen werden geladen …</p>
  {:else if registry.error && !registry.view && !registry.dialog}
    <div class="inline-notice danger" role="alert"><p>{registry.error.message}</p><div class="actions"><button type="button" class="secondary small" onclick={() => registry.refresh()}>Erneut laden</button></div></div>
  {:else if store.sourceTab === 'bindings'}
    <div id="panel-bindings" role="tabpanel" aria-labelledby="tab-bindings" class="stack">
      <HeroStats label="Kennzahlen Quellenzuordnungen" items={[
        { label: 'Aktive Version', value: activeRevision ?? '—', hint: registry.draft ? `Entwurf auf Basis ${registry.base}` : 'Kein Entwurf' },
        { label: 'Quellen', value: sourceRows.length, hint: `${sourceRows.filter((row) => row.binding.device_id).length} mit Gerätebezug` },
        { label: 'Gesund', value: sourceCounts.healthy, tone: 'success' },
        { label: 'Eingeschränkt / blockiert', value: sourceCounts.degraded + sourceCounts.blocked, hint: `${sourceCounts.degraded} eingeschränkt · ${sourceCounts.blocked} blockiert`, tone: sourceCounts.blocked ? 'danger' : sourceCounts.degraded ? 'warning' : 'neutral' },
        { label: 'Unbekannt', value: sourceCounts.unknown, hint: 'neutraler Wert, kein Fehler', tone: 'info' },
      ]} />
      <div class={`list-layout ${selectedSource ? '' : 'no-inspector'}`}>
        <div class="list-panel">
          <ListToolbar ids="sources" filter={store.sourceFilter} onChange={(next) => (store.sourceFilter = next)} sortOptions={sourceSort} domains={sourceDomains} deviceTypes={sourceTypes} showType showCadence total={sourceRows.length} shown={visibleSources.length} addLabel={admin ? 'Quelle hinzufügen' : ''} onAdd={admin ? () => registry.select(null) : undefined} />
          {#if !sourceRows.length}
            <EmptyState title="Keine Quellenzuordnungen" message={admin ? 'Legen Sie die erste Quelle über „Quelle hinzufügen“ an. Der Vorgang bleibt ein Entwurf, bis Sie ihn aktivieren.' : 'Im aktuellen Profil sind keine Quellenzuordnungen vorhanden.'} />
          {:else if !visibleSources.length}
            <EmptyState title="Kein Treffer" message="Keine Quelle passt zu Suche und Filtern." />
          {:else}
            <div class="table-scroll">
              <table class="data-table" aria-label="Quellenzuordnungen">
                <thead><tr><th scope="col">Name</th><th scope="col">Home-Assistant-Entity</th><th scope="col" class="col-p2">Rolle</th><th scope="col" class="col-p2">Gerät</th><th scope="col" class="col-p3">Kadenz</th><th scope="col" class="col-status col-p3">Frische</th><th scope="col" class="col-status">Status</th><th scope="col" class="col-p3">Konsumenten</th><th scope="col" class="col-actions"><span class="sr-only">Aktionen</span></th></tr></thead>
                <tbody>
                  {#each visibleSources as row (row.id)}
                    <tr class:selected={store.selectedBindingId === row.id} class:disabled={row.binding.enabled === false} tabindex="0" aria-selected={store.selectedBindingId === row.id} onclick={() => (store.selectedBindingId = row.id)} onkeydown={(event) => rowKey(event, () => (store.selectedBindingId = row.id))}>
                      <td><span class="cell-main" title={row.name}>{row.name}</span>{#if store.preferences.technicalNames}<span class="secondary-text">{row.binding.binding_id}</span>{/if}</td>
                      <td><EntityId id={row.entityId} name={row.entityName} stacked={false} /></td>
                      <td class="col-p2"><span class="cell-main">{row.role || '—'}</span><span class="secondary-text">{row.capability}</span></td>
                      <td class="col-p2">{#if row.device}<span class="cell-main" title={row.device.name}>{row.device.name}</span>{:else}<span class="quiet">Kein Gerätebezug</span>{/if}</td>
                      <td class="col-p3"><span class="cell-main">{labelForCadence(row.cadence.cadence)}</span><span class="secondary-text">{row.cadence.expectedInterval ? formatDuration(row.cadence.expectedInterval) : 'ohne Intervall'} · Grenze {formatDuration(row.binding.freshness_ttl_seconds)}</span></td>
                      <td class="col-status col-p3"><StatusBadge status={row.freshness} /></td>
                      <td class="col-status">{#if row.configState !== 'configured'}<StatusBadge status={row.configState === 'disabled' ? 'disabled' : row.configState === 'incomplete' ? 'not_configured' : row.health} label={row.configState === 'no_device' ? HEALTH_LABELS[row.health] : CONFIG_STATE_LABELS[row.configState]} />{:else}<StatusBadge status={row.health} />{/if}</td>
                      <td class="col-p3"><span class="cell-main" title={row.consumers.join(', ')}>{row.consumers.length ? row.consumers.join(', ') : '—'}</span></td>
                      <td class="actions">{#if admin}<button type="button" class="ghost icon" aria-label={`Quelle ${row.name} bearbeiten`} onclick={(event) => { event.stopPropagation(); store.selectedBindingId = row.id; registry.select(row.binding); }}><Pencil size={16} aria-hidden="true" /></button>{/if}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
        {#if selectedSource}
          {@const row = selectedSource}
          <aside class="inspector" aria-label="Quellen-Inspector">
            <div class="inspector-head"><div><h2>{row.name}</h2><EntityId id={row.entityId} name={row.entityName} /></div><button type="button" class="ghost icon" aria-label="Inspector schließen" onclick={() => (store.selectedBindingId = null)}><X size={18} aria-hidden="true" /></button></div>
            <div class="badges"><StatusBadge status={row.health} /><StatusBadge status={row.freshness} />{#if row.configState !== 'configured'}<StatusBadge status={row.configState === 'disabled' ? 'disabled' : 'not_configured'} label={CONFIG_STATE_LABELS[row.configState]} />{/if}</div>
            {#if row.entityExists === false}<p class="inline-notice danger">Die Entity existiert aktuell nicht in Home Assistant.</p>{/if}
            <h3>Zuordnung</h3>
            <dl class="kv">
              <div><dt>Rolle / Feld</dt><dd>{row.role || '—'} <span class="quiet">· {row.capability || '—'}</span></dd></div>
              <div><dt>Pflicht</dt><dd>{row.binding.required ? 'Pflichtquelle' : 'Optionale Quelle'}</dd></div>
              <div><dt>Letzter HA-Wert</dt><dd>{lastValue(row.entityId) ?? 'unbekannt'}</dd></div>
              <div><dt>Gerät</dt><dd>{#if row.device}{row.device.name}{#if row.device.model} <span class="quiet">· {row.device.model}</span>{/if}{:else}<span class="quiet">Kein Gerätebezug (Legacy). Über „Bearbeiten“ zuordnen.</span>{/if}</dd></div>
              <div><dt>Meldeverhalten</dt><dd>{labelForCadence(row.cadence.cadence)} <span class="quiet">· {labelForCadenceSource(row.cadence.source)}</span></dd></div>
              <div><dt>Erwartetes Intervall</dt><dd>{formatDuration(row.cadence.expectedInterval)}</dd></div>
              <div><dt>Lebenszeichen</dt><dd>{row.cadence.livenessEntity ?? 'nicht festgelegt'}{#if row.freshnessAssessment?.liveness_configured} <span class="quiet">· {LIVENESS_LABELS[row.freshnessAssessment.liveness_status] ?? row.freshnessAssessment.liveness_status} · Alter {formatDuration(row.freshnessAssessment.liveness_age_seconds)}</span>{/if}</dd></div>
              <div><dt>Frischegrenze</dt><dd>{formatDuration(row.binding.freshness_ttl_seconds)}{#if row.freshnessAssessment} <span class="quiet">· Wert ist {formatDuration(row.freshnessAssessment.value_age_seconds)} alt</span>{/if}</dd></div>
              <div><dt>Fallback</dt><dd>{row.binding.fallback.action}{row.binding.fallback.reason ? ` · ${row.binding.fallback.reason}` : ''}</dd></div>
            </dl>
            {#if row.reasons.length}<h3>Gründe</h3><ul class="reasons">{#each row.reasons as code (code)}<li>{labelForReason(code)}{#if store.preferences.technicalNames} <span class="tech">{code}</span>{/if}</li>{/each}</ul>{/if}
            <h3>Verwendung</h3>
            <dl class="kv">
              <div><dt>Verträge</dt><dd>{#if row.contracts.length}{#each store.rowContext.fusions.filter((fusion) => fusion.input_binding_ids.includes(row.id)) as fusion (fusion.fusion_id)}<button type="button" class="link" onclick={() => onTrace(fusion.contract_id, fusion.field)}><HelpCircle size={13} aria-hidden="true" />{fusion.contract_id}.{fusion.field}</button>{/each}{:else}<span class="quiet">Von keiner Zusammenführung verwendet</span>{/if}</dd></div>
              <div><dt>Verbraucher</dt><dd>{row.consumers.join(', ') || 'Keine deklarierten Verbraucher'}</dd></div>
            </dl>
            {#if store.preferences.technicalNames}<p class="tech">{row.binding.binding_id} · {row.binding.source_id}{row.binding.device_id ? ` · ${row.binding.device_id}` : ''}</p>{/if}
            {#if admin}
              <div class="actions">
                <button type="button" class="primary" onclick={() => registry.select(row.binding)}><Pencil size={15} aria-hidden="true" /> Bearbeiten</button>
                <button type="button" class="secondary" onclick={() => (confirm = { kind: 'toggle', row })}><Power size={15} aria-hidden="true" /> {row.binding.enabled === false ? 'Aktivieren' : 'Deaktivieren'}</button>
                <button type="button" class="secondary" onclick={() => (confirm = { kind: 'delete', row })}><Trash2 size={15} aria-hidden="true" /> Löschen</button>
              </div>
            {/if}
          </aside>
        {/if}
      </div>
    </div>
  {:else}
    <div id="panel-fusions" role="tabpanel" aria-labelledby="tab-fusions" class="stack">
      <HeroStats label="Kennzahlen Zusammenführungen" items={[
        { label: 'Aktive Version', value: activeRevision ?? '—' },
        { label: 'Zusammenführungen', value: fusionRows.length, hint: `${fusionRows.filter((row) => row.missingInputs).length} mit fehlenden Eingängen` },
        { label: 'Gesund', value: fusionCounts.healthy, tone: 'success' },
        { label: 'Eingeschränkt / blockiert', value: fusionCounts.degraded + fusionCounts.blocked, hint: `${fusionCounts.degraded} eingeschränkt · ${fusionCounts.blocked} blockiert`, tone: fusionCounts.blocked ? 'danger' : fusionCounts.degraded ? 'warning' : 'neutral' },
        { label: 'Unbekannt', value: fusionCounts.unknown, hint: 'neutraler Wert, kein Fehler', tone: 'info' },
      ]} />
      <div class={`list-layout ${selectedFusion ? '' : 'no-inspector'}`}>
        <div class="list-panel">
          <ListToolbar ids="fusions" filter={store.fusionFilter} onChange={(next) => (store.fusionFilter = next)} sortOptions={fusionSort} showDomain={false} showNotConfigured={false} total={fusionRows.length} shown={visibleFusions.length} searchLabel="Suchen nach Vertrag, Feld oder Strategie" addLabel={admin ? 'Zusammenführung hinzufügen' : ''} onAdd={admin ? () => registry.selectFusion(null) : undefined} />
          {#if !fusionRows.length}
            <EmptyState title="Keine Zusammenführungen" message="Im aktuellen Profil sind keine Zusammenführungen konfiguriert. Jedes Vertragsfeld braucht eine Zusammenführung, die seine Quellen kombiniert." />
          {:else if !visibleFusions.length}
            <EmptyState title="Kein Treffer" message="Keine Zusammenführung passt zu Suche und Filtern." />
          {:else}
            <div class="table-scroll">
              <table class="data-table" aria-label="Zusammenführungen">
                <thead><tr><th scope="col">Vertragsfeld</th><th scope="col">Strategie</th><th scope="col" class="col-p2">Eingänge</th><th scope="col" class="col-status">Status</th><th scope="col" class="col-p3">Konsumenten</th><th scope="col" class="col-actions"><span class="sr-only">Aktionen</span></th></tr></thead>
                <tbody>
                  {#each visibleFusions as row (row.id)}
                    <tr class:selected={store.selectedFusionId === row.id} tabindex="0" aria-selected={store.selectedFusionId === row.id} onclick={() => (store.selectedFusionId = row.id)} onkeydown={(event) => rowKey(event, () => (store.selectedFusionId = row.id))}>
                      <td><span class="cell-main">{row.contractId}</span><span class="secondary-text">{row.field}{store.preferences.technicalNames ? ` · ${row.fusion.fusion_id}` : ''}</span></td>
                      <td><span class="cell-main">{labelForStrategy(row.strategy)}</span>{#if store.preferences.technicalNames}<span class="secondary-text">{row.strategy}</span>{/if}</td>
                      <td class="col-p2"><span class="cell-main">{row.inputs.length} {row.inputs.length === 1 ? 'Eingang' : 'Eingänge'}</span>{#if row.missingInputs}<span class="secondary-text">{row.missingInputs} fehlt</span>{/if}</td>
                      <td class="col-status"><StatusBadge status={row.health} /></td>
                      <td class="col-p3"><span class="cell-main" title={row.consumers.join(', ')}>{row.consumers.join(', ') || '—'}</span></td>
                      <td class="actions">{#if admin}<button type="button" class="ghost icon" aria-label={`Zusammenführung ${row.name} bearbeiten`} onclick={(event) => { event.stopPropagation(); store.selectedFusionId = row.id; registry.selectFusion(row.fusion); }}><Pencil size={16} aria-hidden="true" /></button>{/if}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
        {#if selectedFusion}
          {@const row = selectedFusion}
          <aside class="inspector" aria-label="Zusammenführungs-Inspector">
            <div class="inspector-head"><div><h2>{row.contractId} · {row.field}</h2>{#if store.preferences.technicalNames}<span class="tech">{row.fusion.fusion_id}</span>{/if}</div><button type="button" class="ghost icon" aria-label="Inspector schließen" onclick={() => (store.selectedFusionId = null)}><X size={18} aria-hidden="true" /></button></div>
            <div class="badges"><StatusBadge status={row.health} /></div>
            <h3>Strategie</h3>
            <p class="strategy"><strong>{labelForStrategy(row.strategy)}</strong>{#if store.preferences.technicalNames} <span class="tech">{row.strategy}</span>{/if}<br /><span class="quiet">{STRATEGY_HELP[row.strategy] ?? ''}</span></p>
            <h3>Eingänge in Reihenfolge</h3>
            <ol class="inputs">
              {#each row.inputs as input (input.kind + input.id)}
                <li class:missing={input.missing} class:active={input.active}><span>{input.label}</span><span class="quiet">{input.kind === 'fusion' ? 'Zusammenführung' : input.required ? 'Pflichtrolle' : 'optional'}{input.missing ? ' · fehlt im Entwurf' : ''}{input.active ? ' · aktuell verwendet' : ''}</span></li>
              {:else}
                <li class="missing">Keine Eingänge konfiguriert.</li>
              {/each}
            </ol>
            <h3>Verwendung</h3>
            <dl class="kv"><div><dt>Verbraucher</dt><dd>{row.consumers.join(', ') || 'Keine deklarierten Verbraucher'}</dd></div><div><dt>Warum?</dt><dd><button type="button" class="link" onclick={() => onTrace(row.contractId, row.field)}><HelpCircle size={13} aria-hidden="true" />Entscheidung für {row.field} erklären</button></dd></div></dl>
            {#if admin}
              <div class="actions">
                <button type="button" class="primary" onclick={() => registry.selectFusion(row.fusion)}><Pencil size={15} aria-hidden="true" /> Bearbeiten</button>
                <button type="button" class="secondary" onclick={() => (confirm = { kind: 'deleteFusion', row })}><Trash2 size={15} aria-hidden="true" /> Löschen</button>
              </div>
            {/if}
          </aside>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if confirm}
  {#if confirm.kind === 'toggle'}
    {@const row = confirm.row as SourceRow}
    <ConfirmDialog title={row.binding.enabled === false ? `Quelle „${row.name}“ aktivieren?` : `Quelle „${row.name}“ deaktivieren?`} message={row.binding.enabled === false ? 'Die Quelle liefert nach der Aktivierung wieder Werte an ihre Zusammenführungen.' : 'Eine deaktivierte Quelle bleibt konfiguriert, liefert aber keine Werte mehr.'} effects={effectsFor(row)} confirmLabel={row.binding.enabled === false ? 'Aktivieren' : 'Deaktivieren'} busy={registry.busy} onConfirm={runConfirm} onCancel={() => (confirm = null)} />
  {:else if confirm.kind === 'delete'}
    {@const row = confirm.row as SourceRow}
    <ConfirmDialog title={`Quelle „${row.name}“ löschen?`} message="Die Quellenzuordnung wird aus dem Entwurf entfernt. Zusammenführungen, die sie verwenden, verlieren diesen Eingang." effects={effectsFor(row)} confirmLabel="Löschen" danger busy={registry.busy} onConfirm={runConfirm} onCancel={() => (confirm = null)} />
  {:else}
    {@const row = confirm.row as FusionRow}
    <ConfirmDialog title={`Zusammenführung „${row.name}“ löschen?`} message="Das Vertragsfeld erhält danach keine Werte mehr aus dieser Zusammenführung." effects={[`Betroffenes Vertragsfeld: ${row.contractId}.${row.field}`, row.consumers.length ? `Betroffene Verbraucher: ${row.consumers.join(', ')}` : 'Keine deklarierten Verbraucher.']} confirmLabel="Löschen" danger busy={registry.busy} onConfirm={runConfirm} onCancel={() => (confirm = null)} />
  {/if}
{/if}

<style>
  .sources, .stack { display: grid; gap: var(--space-4); min-width: 0; }
  .reasons { margin: 0; padding-left: var(--space-4); font-size: 0.78rem; line-height: 1.5; }
  .strategy { margin: 0; font-size: 0.8rem; line-height: 1.5; }
  .inputs { display: grid; gap: var(--space-1); margin: 0; padding-left: var(--space-4); font-size: 0.78rem; }
  .inputs li { display: grid; gap: 1px; padding: var(--space-1) 0; }
  .inputs li.active > span:first-child { color: var(--color-success-foreground); font-weight: 600; }
  .inputs li.missing > span:first-child { color: var(--color-danger-foreground); }
</style>
