<script lang="ts">
  import type { AppView, CoreContractsStore } from "../../lib/core-contracts/store.svelte";
  let {store,view:_view}:{store:CoreContractsStore;view?:AppView}=$props();
  let devices=$derived(store.registry.devices);
</script>

<div class="domain">
  <section class="cards">
    {#each devices as device}
      <article>
        <div><h3>{device.device_id}</h3><small>Technische Geräteidentität</small></div>
        <dl>
          <div><dt>Erwartetes Meldeverhalten</dt><dd>{device.source_cadence}</dd></div>
          <div><dt>Herkunft</dt><dd>{device.cadence_provenance.kind}{device.cadence_provenance.label_id?` · ${device.cadence_provenance.label_id}`:""}</dd></div>
          <div><dt>Intervall</dt><dd>{device.expected_interval_s?`${device.expected_interval_s}s`:"Nicht festgelegt"}</dd></div>
          <div><dt>Lebenszeichen</dt><dd>{device.liveness_entity??"Nicht konfiguriert"}</dd></div>
        </dl>
        <p>{store.registry.bindings.filter(binding=>binding.device_id===device.device_id).length} Quellenzuordnungen betroffen</p>
      </article>
    {:else}
      <article><h3>Noch keine Geräte</h3><p>Geräte werden beim geführten Anlegen einer Quelle aus der HA-Registry vorgeschlagen und ausdrücklich bestätigt.</p></article>
    {/each}
  </section>
</div>

<style>
  .domain,.cards,article,dl{display:grid;gap:var(--space-4)}.cards{grid-template-columns:repeat(auto-fit,minmax(290px,1fr))}article{padding:var(--space-5);border:1px solid var(--color-border);border-radius:var(--radius-card);background:var(--color-surface)}h3,p,dl{margin:0}small,p,dt{color:var(--color-text-muted)}dl>div{display:flex;justify-content:space-between;gap:var(--space-4);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)}dd{margin:0;text-align:right;overflow-wrap:anywhere}
</style>
