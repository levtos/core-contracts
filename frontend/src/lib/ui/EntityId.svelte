<script lang="ts">
  import { Copy } from '@lucide/svelte';
  /** Human name first, technical ID second and truncated. Never widens its cell. */
  let { id, name = '', copyable = true, stacked = true }: { id: string; name?: string; copyable?: boolean; stacked?: boolean } = $props();
  let copied = $state(false);
  async function copy(event: MouseEvent) {
    event.stopPropagation();
    try { await navigator.clipboard?.writeText(id); copied = true; setTimeout(() => (copied = false), 1500); } catch { /* clipboard may be unavailable; the ID stays visible */ }
  }
</script>

<span class="entity" class:stacked>
  {#if name && name !== id}<span class="entity-name truncate" title={name}>{name}</span>{/if}
  <span class="entity-line">
    <code class="entity-id truncate" title={id}>{id || '—'}</code>
    {#if copyable && id}<button type="button" class="ghost icon small" aria-label={copied ? 'Entity-ID kopiert' : `Entity-ID ${id} kopieren`} onclick={copy}><Copy size={13} aria-hidden="true" /></button>{/if}
  </span>
</span>

<style>
  .entity { display: inline-grid; gap: 1px; min-width: 0; max-width: 100%; }
  .entity-line { display: inline-flex; align-items: center; gap: 2px; min-width: 0; max-width: 100%; }
  .entity-name { font-size: 0.8rem; }
  .entity-id { min-width: 0; color: var(--color-text-muted); font-size: 0.7rem; }
</style>
