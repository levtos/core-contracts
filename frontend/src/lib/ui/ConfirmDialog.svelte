<script lang="ts">
  import Dialog from './Dialog.svelte';
  /** Explicit confirmation naming the effects before a deactivate/delete goes into the draft. */
  let { title, message, effects = [], confirmLabel = 'Bestätigen', danger = false, busy = false, onConfirm, onCancel }: {
    title: string; message: string; effects?: string[]; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
  } = $props();
</script>

<Dialog {title} saveLabel={confirmLabel} {danger} {busy} onSave={onConfirm} {onCancel}>
  <p class="confirm-message">{message}</p>
  {#if effects.length}
    <h3 class="confirm-heading">Auswirkungen</h3>
    <ul class="confirm-effects">{#each effects as effect, index (index)}<li>{effect}</li>{/each}</ul>
  {/if}
  <p class="confirm-note">Die Änderung landet nur im Entwurf. Erst „Speichern und aktivieren“ ändert die aktive Version.</p>
</Dialog>

<style>
  .confirm-message { margin: 0 0 var(--space-3); line-height: 1.5; }
  .confirm-heading { margin: 0 0 var(--space-2); font-size: 0.8rem; color: var(--color-text-muted); }
  .confirm-effects { margin: 0 0 var(--space-3); padding-left: var(--space-4); line-height: 1.5; }
  .confirm-note { margin: 0; color: var(--color-text-muted); font-size: 0.76rem; }
</style>
