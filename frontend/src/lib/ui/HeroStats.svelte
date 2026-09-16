<script lang="ts">
  /** Static key figures above a list. No inputs, no entry data. */
  export interface HeroStat { label: string; value: string | number; hint?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
  let { items, label = 'Kennzahlen' }: { items: HeroStat[]; label?: string } = $props();
</script>

<section class="hero-stats" aria-label={label}>
  {#each items as item (item.label)}
    <div class={`hero-stat ${item.tone ?? 'neutral'}`}>
      <span class="hero-label">{item.label}</span>
      <strong class="hero-value">{item.value}</strong>
      {#if item.hint}<small class="hero-hint">{item.hint}</small>{/if}
    </div>
  {/each}
</section>

<style>
  .hero-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-3); }
  .hero-stat { display: grid; gap: 2px; min-width: 0; padding: var(--space-3) var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
  .hero-label { color: var(--color-text-muted); font-size: 0.7rem; }
  .hero-value { font-size: 1.3rem; letter-spacing: -0.03em; overflow-wrap: anywhere; }
  .hero-hint { color: var(--color-text-muted); font-size: 0.68rem; }
  .hero-stat.success { border-color: var(--color-success-border); } .hero-stat.success .hero-value { color: var(--color-success-foreground); }
  .hero-stat.warning { border-color: var(--color-warning-border); } .hero-stat.warning .hero-value { color: var(--color-warning-foreground); }
  .hero-stat.danger { border-color: var(--color-danger-border); } .hero-stat.danger .hero-value { color: var(--color-danger-foreground); }
  .hero-stat.info { border-color: var(--color-info-border); }
</style>
