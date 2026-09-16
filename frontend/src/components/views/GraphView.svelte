<script lang="ts">
  import { ArrowRight, Boxes, Radio, Smartphone, Users, Workflow } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { parseFocus, selectGraphNodes, type GraphMode } from '../../lib/core-contracts/graph-focus';
  import { describeDevice } from '../../lib/core-contracts/listing';
  import { labelForStrategy } from '../../lib/core-contracts/labels';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';

  /** Abhängigkeiten: always focused (device, source, fusion, contract field or consumer), five modes, no animation. */
  let { store, onTrace, onSource }: { store: CoreContractsStore; onTrace: (contractId: string, field: string) => void; onSource?: (bindingId: string) => void } = $props();
  let graph = $derived(store.graph);
  let hass = $derived(store.registry.hass);
  let deviceIds = $derived(graph ? [...new Set(graph.bindings.map((item) => item.device_id).filter((id): id is string => Boolean(id)))] : []);
  let consumerIds = $derived(graph ? [...new Set(graph.fusions.flatMap((item) => item.consumer_ids))] : []);
  let options = $derived(graph ? [
    ...graph.contracts.map((item) => ({ value: `contract:${item.contract_id}`, label: `Vertrag · ${item.contract_id}`, group: 'Verträge' })),
    ...graph.fusions.map((item) => ({ value: `field:${item.contract_id}:${item.field}`, label: `Vertragsfeld · ${item.contract_id}.${item.field}`, group: 'Vertragsfelder' })),
    ...graph.fusions.map((item) => ({ value: `fusion:${item.fusion_id}`, label: `Zusammenführung · ${item.contract_id}.${item.field} (${labelForStrategy(item.strategy)})`, group: 'Zusammenführungen' })),
    ...graph.bindings.map((item) => ({ value: `binding:${item.binding_id}`, label: `Quelle · ${item.display_name || item.entity_id}`, group: 'Quellen' })),
    ...deviceIds.map((id) => ({ value: `device:${id}`, label: `Gerät · ${describeDevice(hass, id)?.name ?? id}`, group: 'Geräte' })),
    ...consumerIds.map((id) => ({ value: `consumer:${id}`, label: `Verbraucher · ${id}`, group: 'Verbraucher' })),
  ] : []);
  let groups = $derived([...new Set(options.map((item) => item.group))]);
  let focus = $derived(options.some((item) => item.value === store.graphFocus) ? store.graphFocus : options[0]?.value ?? '');
  let selection = $derived(graph && focus ? selectGraphNodes(graph, focus, store.graphMode) : null);
  let parsed = $derived(parseFocus(focus));
  const modeLabels: Record<GraphMode, string> = { current: 'Nur aktuelle Entscheidung', all: 'Alle konfigurierten Pfade', impaired: 'Nur beeinträchtigte', upstream: 'Upstream (woher)', downstream: 'Downstream (wohin)' };
  const modeHelp: Record<GraphMode, string> = { current: 'Zeigt nur Quellen und Zusammenführungen, die den aktuell verwendeten Wert liefern.', all: 'Zeigt alle konfigurierten Pfade, auch verworfene Alternativen.', impaired: 'Zeigt nur Pfade zu eingeschränkten oder blockierten Verträgen.', upstream: 'Zeigt, woher der Fokuspunkt seine Daten bezieht.', downstream: 'Zeigt, wohin die Daten des Fokuspunkts fließen.' };
  const isFocus = (kind: string, id: string) => parsed.kind === kind && parsed.id === id;
</script>

<div class="graph">
  <div class="view-head"><div><h2>Abhängigkeiten</h2><p>Fokussierter Ausschnitt des Signalgraphen: Geräte → Quellen → Zusammenführungen → Verträge → Verbraucher. Keine Animation, keine automatische Bewegung.</p></div><StatusBadge status="info" label={`Revision ${store.revision || '—'}`} /></div>
  {#if !graph}
    <EmptyState title="Kein Graph-Snapshot" message="Der aktuelle WebSocket-Stand liefert noch keinen Graph-Snapshot." />
  {:else if !options.length}
    <EmptyState title="Noch keine Abhängigkeiten" message="Legen Sie Verträge, Zusammenführungen und Quellen an, damit der Graph Knoten hat." />
  {:else}
    <div class="controls">
      <label class="field"><span>Fokuspunkt</span><select value={focus} onchange={(event) => (store.graphFocus = event.currentTarget.value)}>{#each groups as group (group)}<optgroup label={group}>{#each options.filter((item) => item.group === group) as option (option.value)}<option value={option.value}>{option.label}</option>{/each}</optgroup>{/each}</select></label>
      <label class="field"><span>Modus</span><select value={store.graphMode} onchange={(event) => (store.graphMode = event.currentTarget.value as GraphMode)}>{#each Object.entries(modeLabels) as [value, label] (value)}<option {value}>{label}</option>{/each}</select><span class="help">{modeHelp[store.graphMode]}</span></label>
    </div>
    {#if selection && selection.bindings.size + selection.fusions.size + selection.contracts.size + selection.devices.size + selection.consumers.size === 0}
      <EmptyState title="Keine Knoten für diesen Modus" message="Im gewählten Fokus gibt es keine passenden Abhängigkeiten." />
    {:else if selection}
      <div class="legend" aria-label="Legende"><span class="used">■ Verwendeter Pfad</span><span class="alternative">□ Alternativer oder verworfener Pfad</span><span class="focus">◆ Fokuspunkt</span><span class="neutral">Unbekannt ist ein neutraler Wert</span></div>
      <div class="flow">
        <section><h3><Smartphone size={16} aria-hidden="true" />Geräte <span>{selection.devices.size}</span></h3>{#each [...selection.devices] as id (id)}<article class:focus={isFocus('device', id)} class:used={graph.bindings.some((item) => item.device_id === id && selection?.currentBindings.has(item.binding_id))}><strong>{describeDevice(hass, id)?.name ?? id}</strong>{#if store.preferences.technicalNames}<code>{id}</code>{/if}</article>{:else}<p class="empty">Kein Gerät in diesem Ausschnitt.</p>{/each}</section>
        <span class="arrow"><ArrowRight size={18} aria-hidden="true" /></span>
        <section><h3><Radio size={16} aria-hidden="true" />Quellen <span>{selection.bindings.size}</span></h3>{#each graph.bindings.filter((item) => selection?.bindings.has(item.binding_id)) as binding (binding.binding_id)}<article class:focus={isFocus('binding', binding.binding_id)} class:used={selection.currentBindings.has(binding.binding_id)} class:alternative={!selection.currentBindings.has(binding.binding_id)}><strong>{binding.display_name || binding.entity_id}</strong><code>{binding.entity_id}</code><p>{binding.field} · {binding.capability}{binding.enabled === false ? ' · deaktiviert' : ''}</p><span class="quiet">{selection.currentBindings.has(binding.binding_id) ? 'liefert den aktuellen Wert' : 'nicht im verwendeten Pfad'}</span>{#if onSource}<button type="button" class="link" onclick={() => onSource?.(binding.binding_id)}>Quelle öffnen</button>{/if}</article>{:else}<p class="empty">Keine Quellen in diesem Ausschnitt.</p>{/each}</section>
        <span class="arrow"><ArrowRight size={18} aria-hidden="true" /></span>
        <section><h3><Workflow size={16} aria-hidden="true" />Zusammenführungen <span>{selection.fusions.size}</span></h3>{#each graph.fusions.filter((item) => selection?.fusions.has(item.fusion_id)) as fusion (fusion.fusion_id)}<article class:focus={isFocus('fusion', fusion.fusion_id) || (parsed.kind === 'field' && parsed.id === fusion.contract_id && parsed.field === fusion.field)} class:used={selection.currentFusions.has(fusion.fusion_id)} class:alternative={!selection.currentFusions.has(fusion.fusion_id)}><strong>{fusion.contract_id}.{fusion.field}</strong>{#if store.preferences.technicalNames}<code>{fusion.fusion_id}</code>{/if}<p>{labelForStrategy(fusion.strategy)}</p><button type="button" class="link" onclick={() => onTrace(fusion.contract_id, fusion.field)}>Warum?</button></article>{:else}<p class="empty">Keine Zusammenführung in diesem Ausschnitt.</p>{/each}</section>
        <span class="arrow"><ArrowRight size={18} aria-hidden="true" /></span>
        <section><h3><Boxes size={16} aria-hidden="true" />Verträge <span>{selection.contracts.size}</span></h3>{#each graph.contracts.filter((item) => selection?.contracts.has(item.contract_id)) as contract (contract.contract_id)}<article class:focus={isFocus('contract', contract.contract_id)} class:used={contract.health === 'healthy'}><div><strong>{contract.contract_id}</strong><StatusBadge status={contract.health} /></div><p>{contract.schema_id}.v{contract.schema_version}</p></article>{:else}<p class="empty">Kein Vertrag in diesem Ausschnitt.</p>{/each}</section>
        <span class="arrow"><ArrowRight size={18} aria-hidden="true" /></span>
        <section><h3><Users size={16} aria-hidden="true" />Verbraucher <span>{selection.consumers.size}</span></h3>{#each [...selection.consumers] as id (id)}<article class:focus={isFocus('consumer', id)}><strong>{id}</strong></article>{:else}<p class="empty">Kein Verbraucher in diesem Ausschnitt.</p>{/each}</section>
      </div>
    {/if}
  {/if}
</div>

<style>
  .graph { display: grid; gap: var(--space-4); }
  .controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
  .legend { display: flex; flex-wrap: wrap; gap: var(--space-2); font-size: 0.72rem; }
  .legend span { padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 999px; }
  .legend .used { border-color: var(--color-success-border); } .legend .alternative { opacity: 0.7; } .legend .focus { border-color: var(--color-info-border); }
  .flow { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.2fr) auto minmax(0, 1.2fr) auto minmax(0, 1fr) auto minmax(0, 0.8fr); align-items: start; gap: var(--space-2); }
  .flow section { display: grid; gap: var(--space-2); min-width: 0; }
  h3 { display: flex; align-items: center; gap: var(--space-2); margin: 0; padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-border); font-size: 0.85rem; }
  h3 span { margin-left: auto; color: var(--color-text-muted); font-weight: 500; }
  article { display: grid; gap: var(--space-1); min-width: 0; padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); font-size: 0.8rem; }
  article > div { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  article strong, article code, article p { overflow-wrap: anywhere; }
  article.used { border-width: 2px; border-color: var(--color-success-border); background: var(--color-success-subtle); }
  article.alternative { opacity: 0.6; border-style: dashed; }
  article.focus { outline: 2px solid var(--color-info); outline-offset: 2px; }
  article p, article code { margin: 0; color: var(--color-text-muted); font-size: 0.72rem; }
  .arrow { align-self: center; color: var(--color-text-muted); }
  .empty { margin: 0; color: var(--color-text-muted); font-size: 0.76rem; }
  @media (max-width: 1100px) { .flow { grid-template-columns: 1fr; } .arrow { display: none; } .controls { grid-template-columns: 1fr; } }
</style>
