<script lang="ts">
  import { RefreshCw, Wifi, WifiOff, LoaderCircle } from "@lucide/svelte";
  import type { ConnectionState, DataState } from "../../lib/ui/state";
  import { CONNECTION_LABELS, DATA_STATE_LABELS } from "../../lib/core-contracts/labels";
  import { formatDateTime } from "../../lib/core-contracts/format";
  import StatusBadge from "../../lib/ui/StatusBadge.svelte";
  import StateBanner from "../../lib/ui/StateBanner.svelte";
  import IconButton from "../../lib/ui/IconButton.svelte";

  /** Connection and data quality are two separate statements; "verbunden" is not a health traffic light. */
  let {
    eyebrow,
    title,
    subline,
    previewStatus = false,
    connectionState,
    dataState,
    errorMessage,
    lastUpdated = null,
    onRefresh,
  }: {
    eyebrow: string;
    title: string;
    subline: string;
    previewStatus?: boolean;
    connectionState: ConnectionState;
    dataState: DataState;
    errorMessage: string | null;
    lastUpdated?: string | null;
    onRefresh: () => void;
  } = $props();
  let ConnectionIcon = $derived(connectionState === "loading" || connectionState === "reconnecting" ? LoaderCircle : connectionState === "connected" ? Wifi : WifiOff);
  let dataStatus = $derived(dataState === "ready" ? "healthy" : dataState === "degraded" ? "degraded" : dataState === "blocked" ? "blocked" : dataState === "stale" ? "stale" : "unknown");
</script>

<header class="topbar">
  <div class="heading">
    <div class="eyebrow">{eyebrow}</div>
    <h1>{title}</h1>
    <p>{subline}</p>
  </div>
  <div class="top-actions">
    <span class="connection" class:off={connectionState !== "connected"} role="status" aria-label={`Verbindung: ${previewStatus ? "lokale Vorschau" : CONNECTION_LABELS[connectionState] ?? connectionState}`}>
      <ConnectionIcon size={15} aria-hidden="true" /><span>{previewStatus ? "Vorschau" : CONNECTION_LABELS[connectionState] ?? connectionState}</span>
      {#if lastUpdated && connectionState === "connected"}<small>Stand {formatDateTime(lastUpdated)}</small>{/if}
    </span>
    <span class="data-quality" title="Datenqualität der Verträge, unabhängig von der Verbindung"><StatusBadge status={dataStatus} label={DATA_STATE_LABELS[dataState] ?? dataState} /></span>
    <IconButton label="Aktualisieren" icon={RefreshCw} onclick={onRefresh} disabled={connectionState === "loading" || connectionState === "reconnecting"} />
  </div>
</header>

{#if errorMessage}
  <div class="top-error"><StateBanner state={connectionState} message={errorMessage} /></div>
{/if}

<style>
  .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); padding: var(--space-6) 0 var(--space-4); }
  .heading { min-width: 0; }
  .heading h1 { margin: var(--space-1) 0 0; font-size: clamp(1.35rem, 2vw, 1.8rem); letter-spacing: -0.04em; }
  .heading p { margin: var(--space-2) 0 0; color: var(--color-text-muted); font-size: 0.8rem; }
  .top-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); padding-top: var(--space-2); }
  .connection { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 32px; padding: 0 var(--space-3); border: 1px solid var(--color-border); border-radius: 999px; color: var(--color-text-secondary); font-size: 0.72rem; }
  .connection.off { border-color: var(--color-warning-border); color: var(--color-warning-foreground); }
  .connection small { color: var(--color-text-muted); font-size: 0.66rem; }
  .top-error { padding: 0 0 var(--space-4); }
  @media (max-width: 860px) { .topbar { flex-direction: column; padding-top: var(--space-4); } .top-actions { width: 100%; justify-content: flex-start; } }
</style>
