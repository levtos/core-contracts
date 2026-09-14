<script lang="ts">
  import { CheckCircle2, CircleDot, FilePenLine } from "@lucide/svelte";
  import type { CoreContractsStore } from "../../lib/core-contracts/store.svelte";
  let { store, onOpen }: { store: CoreContractsStore; onOpen: () => void } = $props();
  let revision = $derived(store.registry.view?.registry.revision?.revision ?? (store.revision || "—"));
  let changes = $derived(store.registry.changeCount);
</script>

<section class="draft-rail" aria-label="Versions- und Entwurfsstatus" aria-live="polite">
  <div><CircleDot size={16} aria-hidden="true" /><span>Aktive Version</span><strong>{revision}</strong></div>
  <div class:attention={(changes??0) > 0}><FilePenLine size={16} aria-hidden="true" /><span>Entwurf</span><strong>{changes===null ? "Wird geladen …" : changes ? `${changes} Änderungen` : "Keiner"}</strong></div>
  <div><CheckCircle2 size={16} aria-hidden="true" /><span>Prüfung</span><strong>{store.registry.validation ? (store.registry.validation.valid ? "Erfolgreich" : "Fehler") : "Ausstehend"}</strong></div>
  <button type="button" onclick={onOpen}>{(changes??0)>0 ? "Prüfen → Speichern → Aktivieren" : "Versionen öffnen"}</button>
</section>

<style>
  .draft-rail { display:flex; align-items:center; gap:var(--space-4); margin:0 var(--space-8) var(--space-4); padding:var(--space-3) var(--space-4); border:1px solid var(--color-border); border-radius:var(--radius-control); background:var(--color-surface); overflow-x:auto; }
  .draft-rail div { display:grid; grid-template-columns:auto auto; align-items:center; gap:2px var(--space-2); min-width:max-content; color:var(--color-text-muted); font-size:.68rem; }
  .draft-rail strong { grid-column:2; color:var(--color-text-primary); font-size:.76rem; }
  .draft-rail .attention strong { color:var(--color-warning-foreground); }
  button { margin-left:auto; min-height:44px; min-width:max-content; padding:0 var(--space-3); border:1px solid var(--color-info-border); border-radius:var(--radius-control); background:var(--color-info-subtle); color:var(--color-info-foreground); }
  @media(max-width:860px){.draft-rail{margin-inline:var(--space-6)}}
  @media(max-width:560px){.draft-rail{margin-inline:var(--space-4)}}
</style>
