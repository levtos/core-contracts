<script lang="ts">
  import { ArrowRight, Boxes, Radio, Workflow } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { selectGraphNodes, type GraphMode } from '../../lib/core-contracts/graph-focus';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';
  let {store}:{store:CoreContractsStore}=$props();
  let graph=$derived(store.graph);
  let options=$derived(graph?[...graph.contracts.map(item=>({value:`contract:${item.contract_id}`,label:`Vertrag · ${item.contract_id}`})),...graph.fusions.map(item=>({value:`fusion:${item.fusion_id}`,label:`Zusammenführung · ${item.contract_id}.${item.field}`})),...graph.bindings.map(item=>({value:`binding:${item.binding_id}`,label:`Quelle · ${item.entity_id}`}))]:[]);
  let focus=$derived(store.graphFocus||options[0]?.value||'');
  let selection=$derived(graph&&focus?selectGraphNodes(graph,focus,store.graphMode):null);
  const modeLabels:Record<GraphMode,string>={current:'Nur aktuelle Entscheidung',all:'Alle konfigurierten Pfade',impaired:'Nur beeinträchtigte',upstream:'Upstream',downstream:'Downstream'};
</script>

<div class="graph">
  <header>
    <div><h2>Abhängigkeiten</h2><p>Fokussierter Ausschnitt ohne automatische Bewegung oder Zoomanimation.</p></div>
    <StatusBadge status="info" label={`Revision ${store.revision||'—'}`}/>
  </header>
  {#if !graph}
    <EmptyState title="Kein Graph-Snapshot" message="Der aktuelle WebSocket-Stand liefert noch keinen Graph-Snapshot."/>
  {:else}
    <div class="controls">
      <label>Fokuspunkt<select value={focus} onchange={event=>store.graphFocus=event.currentTarget.value}>{#each options as option}<option value={option.value}>{option.label}</option>{/each}</select></label>
      <label>Modus<select value={store.graphMode} onchange={event=>store.graphMode=event.currentTarget.value as GraphMode}>{#each Object.entries(modeLabels) as [value,label]}<option {value}>{label}</option>{/each}</select></label>
    </div>
    {#if selection&&selection.bindings.size+selection.fusions.size+selection.contracts.size===0}
      <EmptyState title="Keine Knoten für diesen Modus" message="Im gewählten Fokus gibt es keine passenden Abhängigkeiten."/>
    {:else}
      <div class="legend"><span class="used">Verwendeter Pfad</span><span class="alternative">Alternativer oder verworfener Pfad</span><span class="neutral">Unbekannt ist neutral</span></div>
      <div class="flow">
        <section><h3><Radio size={16}/>Quellen <span>{selection?.bindings.size??0}</span></h3>{#each graph.bindings.filter(item=>selection?.bindings.has(item.binding_id)) as binding}<article class:used={selection?.currentBindings.has(binding.binding_id)} class:alternative={!selection?.currentBindings.has(binding.binding_id)}><strong>{binding.entity_id}</strong>{#if store.preferences.technicalNames}<code>{binding.binding_id}</code>{/if}<p>{binding.field} · {binding.capability}</p></article>{:else}<p class="empty">Keine Quellen in diesem Ausschnitt.</p>{/each}</section>
        <span class="arrow"><ArrowRight size={20}/></span>
        <section><h3><Workflow size={16}/>Zusammenführungen <span>{selection?.fusions.size??0}</span></h3>{#each graph.fusions.filter(item=>selection?.fusions.has(item.fusion_id)) as fusion}<article class:used={selection?.currentFusions.has(fusion.fusion_id)} class:alternative={!selection?.currentFusions.has(fusion.fusion_id)}><strong>{fusion.contract_id}.{fusion.field}</strong>{#if store.preferences.technicalNames}<code>{fusion.fusion_id}</code>{/if}<p>{fusion.strategy}</p></article>{:else}<p class="empty">Keine Zusammenführung in diesem Ausschnitt.</p>{/each}</section>
        <span class="arrow"><ArrowRight size={20}/></span>
        <section><h3><Boxes size={16}/>Verträge <span>{selection?.contracts.size??0}</span></h3>{#each graph.contracts.filter(item=>selection?.contracts.has(item.contract_id)) as contract}<article class:used={contract.health==='healthy'}><div><strong>{contract.contract_id}</strong><StatusBadge status={contract.health}/></div><p>{contract.schema_id}.v{contract.schema_version}</p></article>{:else}<p class="empty">Kein Vertrag in diesem Ausschnitt.</p>{/each}</section>
      </div>
    {/if}
  {/if}
</div>

<style>
  .graph{display:grid;gap:var(--space-5)}header,.controls,.legend,.flow,h3,article>div{display:flex;align-items:center;gap:var(--space-3)}header{justify-content:space-between}h2,h3,p{margin:0}header p,.empty{color:var(--color-text-muted)}.controls{flex-wrap:wrap}.controls label{display:grid;gap:var(--space-2);color:var(--color-text-muted);font-size:.75rem}.controls select{min-height:44px;min-width:260px;padding:0 var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-control);background:var(--color-surface);color:var(--color-text-primary)}.legend{flex-wrap:wrap;font-size:.72rem}.legend span{padding:6px 10px;border:1px solid var(--color-border);border-radius:999px}.legend .used{border-color:var(--color-success-border)}.legend .alternative{opacity:.65}.flow{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr);align-items:start}.flow section{display:grid;gap:var(--space-2);min-width:0}.flow h3{padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)}.flow h3 span{margin-left:auto;color:var(--color-text-muted)}article{display:grid;gap:var(--space-2);padding:var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-control);background:var(--color-surface)}article.used{border-width:2px;border-color:var(--color-success-border);background:var(--color-success-subtle)}article.alternative{opacity:.58}article p,code{color:var(--color-text-muted);overflow-wrap:anywhere}.arrow{align-self:center;color:var(--color-text-muted)}@media(max-width:900px){.flow{grid-template-columns:1fr}.arrow{display:none}.controls label,.controls select{width:100%;min-width:0}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
