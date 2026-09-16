<script lang="ts">
  import { ArrowLeft, HelpCircle, Pencil } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { formatDateTime, formatValue, labelForSchema } from '../../lib/core-contracts/format';
  import { FALLBACK_LABELS, REQUIREMENT_STATUS_LABELS, labelForReason, labelForStrategy } from '../../lib/core-contracts/labels';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';

  /** Independent full contract detail route with overview, fields, dependencies, usage and technical details. */
  let { store, onBack, onTrace, onSource, onFusion }: { store: CoreContractsStore; onBack: () => void; onTrace: (id: string, field: string) => void; onSource?: (bindingId: string) => void; onFusion?: (fusionId: string) => void } = $props();
  let tab = $state<'overview' | 'fields' | 'dependencies' | 'usage' | 'technical'>('overview');
  let contract = $derived(store.selectedContract);
  let diagnostic = $derived(store.selectedDiagnostics);
  let instance = $derived(store.registry.instances.find((item) => item.contract_id === contract?.contract_id) ?? null);
  let fusions = $derived(store.rowContext.fusions.filter((item) => item.contract_id === contract?.contract_id));
  let bindingIds = $derived(new Set(fusions.flatMap((item) => item.input_binding_ids)));
  let sources = $derived(store.sourceRows.filter((row) => bindingIds.has(row.id)));
  let requirements = $derived((store.registry.view?.requirements ?? []).filter((item) => item.contract_id === contract?.contract_id));
  let consumers = $derived([...new Set([...fusions.flatMap((item) => item.consumer_ids), ...requirements.map((item) => item.consumer_id)])]);
  const diag = (field: string) => diagnostic?.fields.find((item) => item.field === field) ?? null;
  const tabs: { id: typeof tab; label: string }[] = [{ id: 'overview', label: 'Überblick' }, { id: 'fields', label: 'Felder' }, { id: 'dependencies', label: 'Abhängigkeiten' }, { id: 'usage', label: 'Verwendung' }, { id: 'technical', label: 'Technische Details' }];
</script>

<div class="detail-view">
  <button type="button" class="ghost back" onclick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Zurück zu Verträgen</button>
  {#if contract}
    <header class="view-head">
      <div><p class="eyebrow">{labelForSchema(contract.schema_id)} · Schema v{contract.schema_version}</p><h2>{String(instance?.display_name ?? '') || contract.contract_id}</h2><p>{instance?.display_name || store.preferences.technicalNames ? `${contract.contract_id} · ` : ''}Stand {store.when(contract.generated_at)}</p></div>
      <div class="head-actions"><StatusBadge status={contract.health} />{#if store.registry.admin && instance}<button type="button" class="secondary small" onclick={() => store.registry.selectInstance(instance)}><Pencil size={14} aria-hidden="true" /> Bearbeiten</button>{/if}</div>
    </header>
    <div class="tabs" role="tablist" aria-label="Vertragsdetails">{#each tabs as item (item.id)}<button type="button" role="tab" aria-selected={tab === item.id} onclick={() => (tab = item.id)}>{item.label}</button>{/each}</div>

    {#if tab === 'overview'}
      <section class="cards" role="tabpanel">
        {#each Object.entries(contract.values) as [field, value] (field)}
          <article><span class="quiet">{field}</span><strong>{formatValue(value)}</strong><div class="badges"><StatusBadge status={contract.field_quality[field]?.health ?? 'unknown'} /><StatusBadge status={contract.field_quality[field]?.freshness ?? 'unknown'} /></div><button type="button" class="link" onclick={() => onTrace(contract.contract_id, field)}><HelpCircle size={15} aria-hidden="true" />Warum?</button></article>
        {/each}
      </section>
    {:else if tab === 'fields'}
      <section class="stack" role="tabpanel">
        {#each Object.keys(contract.field_states) as field (field)}
          {@const quality = contract.field_quality[field]}
          {@const evaluation = contract.field_evaluations[field]}
          <article>
            <div class="row-head"><h3>{field}</h3><button type="button" class="link" onclick={() => onTrace(contract.contract_id, field)}><HelpCircle size={14} aria-hidden="true" />Warum?</button></div>
            <dl class="kv">
              <div><dt>Wert</dt><dd>{formatValue(contract.values[field])}</dd></div>
              <div><dt>Zustand</dt><dd><StatusBadge status={contract.field_states[field]} /></dd></div>
              <div><dt>Qualität · Frische · Sicherheit</dt><dd><span class="badges"><StatusBadge status={quality?.quality ?? 'unknown'} /><StatusBadge status={quality?.freshness ?? 'unknown'} /><StatusBadge status={quality?.safety ?? 'unknown'} /></span></dd></div>
              <div><dt>Strategie</dt><dd>{labelForStrategy(evaluation?.strategy ?? 'none')}</dd></div>
              <div><dt>Aktive Quelle</dt><dd>{diag(field)?.active_source_entities.join(', ') || 'keine aktive Quelle'}</dd></div>
              <div><dt>Fallback</dt><dd>{FALLBACK_LABELS[quality?.fallback ?? 'none'] ?? quality?.fallback}</dd></div>
              {#if quality?.reasons.length}<div><dt>Gründe</dt><dd>{quality.reasons.map((reason) => labelForReason(reason.code, reason.message)).join(' ')}</dd></div>{/if}
            </dl>
          </article>
        {/each}
      </section>
    {:else if tab === 'dependencies'}
      <section class="stack" role="tabpanel">
        <h3>Quellen (Upstream)</h3>
        {#each sources as row (row.id)}<article class="dep"><div><strong>{row.name}</strong><span class="quiet">{row.entityId} · {row.role}{row.device ? ` · ${row.device.name}` : ' · kein Gerätebezug'}</span></div><div class="badges"><StatusBadge status={row.health} />{#if onSource}<button type="button" class="link" onclick={() => onSource?.(row.id)}>Quelle öffnen</button>{/if}</div></article>{:else}<p class="quiet">Keine konfigurierten Quellen.</p>{/each}
        <h3>Zusammenführungen</h3>
        {#each fusions as fusion (fusion.fusion_id)}<article class="dep"><div><strong>{fusion.field}</strong><span class="quiet">{labelForStrategy(fusion.strategy)} · {fusion.input_binding_ids.length} Quellen{fusion.input_fusion_ids.length ? ` · ${fusion.input_fusion_ids.length} Zusammenführungen` : ''}{store.preferences.technicalNames ? ` · ${fusion.fusion_id}` : ''}</span></div>{#if onFusion}<button type="button" class="link" onclick={() => onFusion?.(fusion.fusion_id)}>Öffnen</button>{/if}</article>{:else}<p class="quiet">Keine Zusammenführung konfiguriert. Ohne Zusammenführung bleibt jedes Feld unbekannt.</p>{/each}
      </section>
    {:else if tab === 'usage'}
      <section class="stack" role="tabpanel">
        {#each consumers as consumer (consumer)}
          {@const states = requirements.filter((item) => item.consumer_id === consumer)}
          <article class="dep"><div><strong>{consumer}</strong><span class="quiet">{states.length ? states.map((item) => `${item.role ?? 'Vertrag'}: ${REQUIREMENT_STATUS_LABELS[item.status] ?? item.status}`).join(' · ') : 'deklariert über Zusammenführung'}</span></div>{#if states.length}<StatusBadge status={states.every((item) => item.status === 'healthy') ? 'healthy' : states.some((item) => item.status === 'blocked' || item.status === 'missing') ? 'blocked' : 'degraded'} />{/if}</article>
        {:else}<p class="quiet">Keine deklarierten Verbraucher.</p>{/each}
        {#each diagnostic?.fields ?? [] as field (field.field)}{#if field.consumer_impact?.length}<article class="dep"><div><strong>{field.field}</strong><span class="quiet">{field.consumer_impact.map((impact) => `${impact.consumer_id}: ${REQUIREMENT_STATUS_LABELS[impact.status] ?? impact.status}`).join(' · ')}</span></div></article>{/if}{/each}
      </section>
    {:else}
      <section class="technical" role="tabpanel">
        <dl class="kv"><div><dt>Contract-ID</dt><dd>{contract.contract_id}</dd></div><div><dt>Schema</dt><dd>{contract.schema_id}.v{contract.schema_version}</dd></div><div><dt>Generiert</dt><dd>{formatDateTime(contract.generated_at)}</dd></div><div><dt>Felder</dt><dd>{Object.keys(contract.values).length}</dd></div><div><dt>Registry-Revision</dt><dd>{diagnostic?.registry_revision ?? '—'}</dd></div></dl>
        <details><summary>Typisierter Contract-Payload (Roh-JSON)</summary><pre>{JSON.stringify(contract, null, 2)}</pre></details>
      </section>
    {/if}
  {:else}
    <section class="empty"><h2>Vertrag nicht gefunden</h2><p class="quiet">Der direkte Link verweist auf keinen Vertrag im aktuellen Profil.</p></section>
  {/if}
</div>

<style>
  .detail-view { display: grid; gap: var(--space-4); max-width: 1180px; }
  .back { justify-self: start; display: inline-flex; align-items: center; gap: var(--space-2); }
  .head-actions { display: flex; align-items: center; gap: var(--space-2); }
  .head-actions button { display: inline-flex; align-items: center; gap: var(--space-1); }
  .eyebrow { margin: 0; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
  article, .technical, .empty { display: grid; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
  article strong { overflow-wrap: anywhere; }
  .stack { display: grid; gap: var(--space-3); }
  .stack h3 { margin: var(--space-2) 0 0; font-size: 0.8rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .row-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .row-head h3 { margin: 0; font-size: 0.95rem; text-transform: none; letter-spacing: 0; color: var(--color-text-primary); }
  .dep { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
  .dep > div:first-child { display: grid; gap: 2px; min-width: 0; }
  .dep .quiet { font-size: 0.74rem; overflow-wrap: anywhere; }
  pre { overflow: auto; max-height: 420px; font-size: 0.72rem; }
  @media (max-width: 560px) { .dep { grid-template-columns: 1fr; } }
</style>
