<script lang="ts">
  import { ArrowLeft, Check, X } from '@lucide/svelte';
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import { formatDuration, formatValue, labelForSchema } from '../../lib/core-contracts/format';
  import { LIVENESS_LABELS, STRATEGY_HELP, labelForCadence, labelForCadenceSource, labelForReason, labelForStrategy } from '../../lib/core-contracts/labels';
  import { effectiveCadence } from '../../lib/core-contracts/listing';
  import StatusBadge from '../../lib/ui/StatusBadge.svelte';

  /**
   * Warum?: result, candidates, chosen candidate, rejection reasons, timestamps,
   * age versus limit, cadence with origin, liveness with age and limit,
   * strategy and a plain-language conclusion. Raw JSON is a collapsed extra.
   */
  let { store, onBack, onSource }: { store: CoreContractsStore; onBack: () => void; onSource?: (bindingId: string) => void } = $props();
  let contract = $derived(store.selectedContract);
  let field = $derived(store.selectedField ?? (contract ? Object.keys(contract.values)[0] : null));
  let evaluation = $derived(contract && field ? contract.field_evaluations[field] ?? null : null);
  let quality = $derived(contract && field ? contract.field_quality[field] ?? null : null);
  let diagnostic = $derived(field ? store.selectedDiagnostics?.fields.find((item) => item.field === field) ?? null : null);
  let assessment = $derived(diagnostic?.freshness_assessment ?? quality?.freshness_assessment ?? null);
  let fusion = $derived(store.rowContext.fusions.find((item) => item.contract_id === contract?.contract_id && item.field === field) ?? null);
  let candidateIds = $derived([...new Set([...(evaluation?.candidate_binding_ids ?? []), ...(diagnostic?.binding_ids ?? []), ...(fusion?.input_binding_ids ?? [])])]);
  let candidates = $derived(candidateIds.map((id) => {
    const binding = store.rowContext.bindings.find((item) => item.binding_id === id) ?? store.graph?.bindings.find((item) => item.binding_id === id) ?? null;
    const signal = store.graph?.signals.find((item) => item.binding_id === id) ?? null;
    const chosen = evaluation?.active_binding_ids.includes(id) ?? false;
    const ownAssessment = signal?.quality.freshness_assessment ?? (chosen ? assessment : null);
    const cadence = binding ? effectiveCadence(binding, store.rowContext.devices) : null;
    const reasons = signal?.quality.reasons ?? (diagnostic?.root_causes.filter((cause) => cause.source_entity === binding?.entity_id) ?? []);
    return { id, binding, signal, chosen, assessment: ownAssessment, cadence, reasons, order: fusion?.input_binding_ids.indexOf(id) ?? -1 };
  }).sort((a, b) => (a.order === -1 ? 99 : a.order) - (b.order === -1 ? 99 : b.order)));
  let chosen = $derived(candidates.find((item) => item.chosen) ?? null);
  const ageText = (age: number | null | undefined, limit: number | null | undefined) => age === null || age === undefined ? 'Alter unbekannt' : `${formatDuration(age)} alt${limit ? ` · Grenze ${formatDuration(limit)}` : ''}${age !== null && limit ? (age > limit ? ' · überschritten' : ' · innerhalb') : ''}`;
  let explanation = $derived.by(() => {
    if (!contract || !field || !evaluation) return '';
    const strategy = labelForStrategy(evaluation.strategy);
    const value = formatValue(contract.values[field]);
    if (!candidates.length) return `Für „${field}“ ist keine Quelle konfiguriert. Der Wert bleibt „unbekannt“, bis eine Zusammenführung mit mindestens einer Quelle angelegt ist.`;
    if (chosen) return `Die Strategie „${strategy}“ hat die Quelle „${chosen.binding?.display_name || chosen.binding?.entity_id || chosen.id}“ gewählt. Sie war ${candidates.length > 1 ? 'in der Reihenfolge die erste' : 'die einzige'} verwendbare Quelle. Der gemeldete Wert ist „${value}“; Frische ist „${quality?.freshness ?? 'unbekannt'}“.`;
    const first = candidates[0];
    const reason = first.reasons[0] ? labelForReason(first.reasons[0].code, first.reasons[0].message) : evaluation.note ? labelForReason(evaluation.note) : 'Keine Quelle erfüllte die Bedingungen.';
    return `Die Strategie „${strategy}“ hat keinen verwendbaren Kandidaten gefunden. ${reason} Der Wert ist deshalb „${value}“; „unbekannt“ ist hier eine gültige neutrale Aussage.`;
  });
</script>

<div class="trace">
  <button type="button" class="ghost back" onclick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Zurück zum Vertrag</button>
  {#if contract && field && quality && evaluation}
    <header class="view-head"><div><p class="eyebrow">{labelForSchema(contract.schema_id)} · {contract.contract_id}</p><h2>Warum ist „{field}“ so?</h2></div><StatusBadge status={quality.health} /></header>

    <section class="result" aria-label="Ergebnis">
      <div><span class="quiet">Aktuelles Ergebnis</span><strong>{formatValue(contract.values[field])}</strong></div>
      <div><span class="quiet">Zustand</span><StatusBadge status={contract.field_states[field]} /></div>
      <div><span class="quiet">Qualität</span><StatusBadge status={quality.quality} /></div>
      <div><span class="quiet">Frische</span><StatusBadge status={quality.freshness} /></div>
      <div><span class="quiet">Sicherheit</span><StatusBadge status={quality.safety} /></div>
      <div><span class="quiet">Berechnet</span><strong>{store.when(contract.generated_at)}</strong></div>
    </section>

    <section class="explanation" aria-label="Erklärung">
      <h3>Entscheidung in einfacher Sprache</h3>
      <p>{explanation}</p>
      <p class="quiet">Strategie „{labelForStrategy(evaluation.strategy)}“{store.preferences.technicalNames ? ` (${evaluation.strategy})` : ''}: {STRATEGY_HELP[evaluation.strategy] ?? ''}</p>
      {#if quality.reasons.length}<ul class="reasons">{#each quality.reasons as reason (reason.code)}<li><strong>{labelForReason(reason.code, reason.message)}</strong>{#if reason.since} <span class="quiet">seit {store.when(reason.since)} · {formatDuration(reason.duration_seconds)}</span>{/if}{#if store.preferences.technicalNames} <span class="tech">{reason.code}</span>{/if}</li>{/each}</ul>{/if}
    </section>

    {#if assessment}
      <section class="assessment" aria-label="Frische und Lebenszeichen">
        <h3>Frische und Lebenszeichen</h3>
        <dl class="kv">
          <div><dt>Verwendeter Zeitstempel</dt><dd>{store.when(assessment.value_timestamp)} <span class="quiet">· Ursprung {assessment.value_timestamp_origin}</span></dd></div>
          <div><dt>Alter gegen Grenze</dt><dd>{ageText(assessment.value_age_seconds, assessment.ttl_seconds)}</dd></div>
          <div><dt>Kadenz</dt><dd>{labelForCadence(assessment.cadence)} <span class="quiet">· {labelForCadenceSource(assessment.cadence_source)}{assessment.cadence_provenance ? ` · ${assessment.cadence_provenance}` : ''}</span></dd></div>
          <div><dt>Bewertungsgrundlage</dt><dd>{assessment.basis === 'device_liveness' ? 'Lebenszeichen des Geräts' : 'Zeitgrenze (TTL)'}</dd></div>
          <div><dt>Lebenszeichen</dt><dd>{#if assessment.liveness_configured}{assessment.liveness_entity} <span class="quiet">· {LIVENESS_LABELS[assessment.liveness_status] ?? assessment.liveness_status} · {ageText(assessment.liveness_age_seconds, assessment.expected_interval_s)}</span>{:else}<span class="quiet">nicht konfiguriert{assessment.expected_interval_s ? ` · erwartetes Intervall ${formatDuration(assessment.expected_interval_s)}` : ''}</span>{/if}</dd></div>
          {#if assessment.plausibility_reason}<div><dt>Plausibilität</dt><dd>{assessment.plausibility_reason}</dd></div>{/if}
          {#if assessment.shared_binding_count > 1}<div><dt>Gleich konfiguriert</dt><dd>{assessment.shared_binding_count} Quellen mit derselben Kadenz und Grenze</dd></div>{/if}
        </dl>
      </section>
    {/if}

    <section aria-label="Kandidaten">
      <h3>Kandidaten in Reihenfolge</h3>
      {#if !candidates.length}<p class="quiet">Keine Quelle konfiguriert.</p>{/if}
      <div class="candidates">
        {#each candidates as candidate (candidate.id)}
          <article class:chosen={candidate.chosen}>
            <div class="decision">{#if candidate.chosen}<Check size={18} aria-hidden="true" /><strong>Gewählt</strong>{:else}<X size={18} aria-hidden="true" /><strong>Nicht gewählt</strong>{/if}{#if candidate.order >= 0}<span class="quiet">Priorität {candidate.order + 1}</span>{/if}</div>
            <h4>{candidate.binding?.display_name || candidate.binding?.entity_id || candidate.id}</h4>
            <span class="tech">{candidate.binding?.entity_id ?? candidate.id}</span>
            <dl class="kv">
              <div><dt>Wert</dt><dd>{candidate.signal ? formatValue(candidate.signal.value) : 'noch kein Signal empfangen'}</dd></div>
              <div><dt>Qualität</dt><dd><span class="badges"><StatusBadge status={candidate.signal?.quality.health ?? 'unknown'} /><StatusBadge status={candidate.signal?.quality.freshness ?? 'unknown'} /></span></dd></div>
              <div><dt>Gerätezeit</dt><dd>{store.when(candidate.signal?.evidence.device_timestamp ?? null)}</dd></div>
              <div><dt>Home-Assistant-Zeit</dt><dd>{store.when(candidate.signal?.evidence.ha_timestamp ?? null)}</dd></div>
              <div><dt>Zeitstempelquelle</dt><dd>{candidate.signal ? (candidate.signal.evidence.device_timestamp ? 'Gerät' : 'Home Assistant') : '—'}{candidate.signal?.evidence.restored ? ' · wiederhergestellt' : ''}{candidate.signal?.evidence.retained ? ' · retained' : ''}</dd></div>
              <div><dt>Alter gegen Grenze</dt><dd>{candidate.assessment ? ageText(candidate.assessment.value_age_seconds, candidate.assessment.ttl_seconds) : `Grenze ${formatDuration(candidate.binding?.freshness_ttl_seconds ?? null)}`}</dd></div>
              <div><dt>Kadenz</dt><dd>{candidate.cadence ? `${labelForCadence(candidate.cadence.cadence)} · ${labelForCadenceSource(candidate.cadence.source)}` : '—'}</dd></div>
              <div><dt>Lebenszeichen</dt><dd>{candidate.cadence?.livenessEntity ?? 'nicht festgelegt'}{candidate.assessment?.liveness_configured ? ` · ${LIVENESS_LABELS[candidate.assessment.liveness_status] ?? candidate.assessment.liveness_status} · ${ageText(candidate.assessment.liveness_age_seconds, candidate.assessment.expected_interval_s)}` : candidate.cadence?.expectedInterval ? ` · erwartet alle ${formatDuration(candidate.cadence.expectedInterval)}` : ''}</dd></div>
            </dl>
            <p class="verdict">{candidate.chosen ? 'Diese Quelle bildet den aktuell verwendeten Pfad.' : candidate.reasons.length ? `Verworfen: ${candidate.reasons.map((reason) => labelForReason(reason.code, reason.message)).join(' ')}` : candidate.binding?.enabled === false ? 'Verworfen: Die Quelle ist deaktiviert.' : chosen ? 'Nicht benötigt: Eine Quelle mit höherer Priorität war verwendbar.' : 'Verworfen: Kein verwendbares Signal.'}</p>
            {#if onSource && candidate.binding}<button type="button" class="link" onclick={() => onSource?.(candidate.id)}>Quelle öffnen</button>{/if}
          </article>
        {/each}
      </div>
    </section>

    <details><summary>Technische Details (Roh-JSON)</summary><pre>{JSON.stringify({ evaluation, quality, diagnostic, signals: candidates.map((item) => item.signal) }, null, 2)}</pre></details>
  {:else}
    <p class="quiet">Wählen Sie in einem Vertrag bei einem Feld „Warum?“.</p>
  {/if}
</div>

<style>
  .trace { display: grid; gap: var(--space-4); max-width: 1180px; }
  .back { justify-self: start; display: inline-flex; align-items: center; gap: var(--space-2); }
  .eyebrow { margin: 0; }
  .result { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-3); }
  .result > div, article, .explanation, .assessment, details { display: grid; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
  h3 { margin: 0; font-size: 0.9rem; } h4 { margin: 0; font-size: 0.95rem; overflow-wrap: anywhere; }
  .explanation p { margin: 0; line-height: 1.6; }
  .reasons { margin: 0; padding-left: var(--space-4); font-size: 0.8rem; line-height: 1.5; }
  .candidates { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-3); margin-top: var(--space-2); }
  article.chosen { border-color: var(--color-success-border); box-shadow: inset 4px 0 0 var(--color-success); }
  article:not(.chosen) { opacity: 0.85; }
  .decision { display: flex; align-items: center; gap: var(--space-2); }
  article.chosen .decision { color: var(--color-success-foreground); }
  .verdict { margin: 0; font-size: 0.8rem; line-height: 1.45; }
  pre { overflow: auto; max-height: 360px; font-size: 0.72rem; }
</style>
