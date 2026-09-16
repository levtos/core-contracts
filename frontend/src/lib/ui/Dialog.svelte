<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { X } from '@lucide/svelte';

  /**
   * Accessible modal dialog: focus trap, Escape, restored focus, explicit
   * Save/Cancel. Nothing in here persists anything; the owner decides.
   */
  let {
    title,
    subtitle = '',
    saveLabel = 'Speichern',
    cancelLabel = 'Abbrechen',
    busy = false,
    saveDisabled = false,
    danger = false,
    wide = false,
    onSave,
    onCancel,
    children,
    footer,
  }: {
    title: string;
    subtitle?: string;
    saveLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    saveDisabled?: boolean;
    danger?: boolean;
    wide?: boolean;
    onSave?: () => void;
    onCancel: () => void;
    children?: Snippet;
    footer?: Snippet;
  } = $props();

  let panel: HTMLElement | undefined = $state();
  const id = `dialog-${Math.random().toString(36).slice(2, 8)}`;
  const focusable = () => [...(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? [])];

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); return; }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) { event.preventDefault(); panel?.focus(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? focusable().find((item) => !item.closest('.dialog-head')) ?? panel;
    target?.focus();
    return () => { document.body.style.overflow = previousOverflow; previous?.focus?.(); };
  });
</script>

<div class="dialog-backdrop" role="presentation">
  <div class="dialog" class:wide class:danger role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={subtitle ? `${id}-subtitle` : undefined} tabindex="-1" bind:this={panel} onkeydown={keydown}>
    <header class="dialog-head">
      <div>
        <h2 id={`${id}-title`}>{title}</h2>
        {#if subtitle}<p id={`${id}-subtitle`}>{subtitle}</p>{/if}
      </div>
      <button type="button" class="ghost icon" aria-label="Dialog schließen (Abbrechen)" onclick={onCancel}><X size={18} aria-hidden="true" /></button>
    </header>
    <div class="dialog-body">{@render children?.()}</div>
    <footer class="dialog-foot">
      {@render footer?.()}
      <div class="dialog-actions">
        <button type="button" class="secondary" onclick={onCancel} disabled={busy}>{cancelLabel}</button>
        {#if onSave}<button type="button" class={danger ? 'danger' : 'primary'} onclick={onSave} disabled={busy || saveDisabled} aria-busy={busy}>{busy ? 'Bitte warten …' : saveLabel}</button>{/if}
      </div>
    </footer>
  </div>
</div>

<style>
  .dialog-backdrop { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: var(--space-4); background: color-mix(in srgb, var(--color-background) 72%, transparent); }
  .dialog { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(760px, 100%); max-height: min(92vh, 100%); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); box-shadow: var(--shadow-panel); outline: none; }
  .dialog.wide { width: min(980px, 100%); }
  .dialog:focus-visible { outline: 2px solid var(--color-info); }
  .dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-6) var(--space-3); border-bottom: 1px solid var(--color-border); }
  .dialog-head h2 { margin: 0; font-size: 1.05rem; letter-spacing: -0.02em; overflow-wrap: anywhere; }
  .dialog-head p { margin: var(--space-1) 0 0; color: var(--color-text-muted); font-size: 0.76rem; overflow-wrap: anywhere; }
  .dialog-body { overflow: auto; padding: var(--space-4) var(--space-6); }
  .dialog-foot { display: grid; gap: var(--space-3); padding: var(--space-3) var(--space-6) var(--space-4); border-top: 1px solid var(--color-border); }
  .dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); }
  .dialog.danger .dialog-head { border-color: var(--color-danger-border); }
  @media (max-width: 640px) { .dialog-backdrop { padding: 0; align-items: end; } .dialog { width: 100%; max-height: 100vh; border-radius: var(--radius-card) var(--radius-card) 0 0; } .dialog-head, .dialog-body, .dialog-foot { padding-inline: var(--space-4); } .dialog-actions button { flex: 1; } }
</style>
