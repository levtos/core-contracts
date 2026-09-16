<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ConnectionState, DataState } from "../../lib/ui/state";
  import type { NavItem } from "./types";
  import TopBar from "./TopBar.svelte";

  /**
   * Panel shell: top bar, horizontal module navigation, version rail and
   * content share one page-width wrapper so every left edge aligns. There is
   * no second fixed sidebar inside the Home Assistant panel.
   */
  let {
    activeView,
    navItems,
    title,
    eyebrow,
    subline,
    previewStatus,
    connectionState,
    dataState,
    errorMessage,
    lastUpdated,
    onViewChange,
    onRefresh,
    uxClass = "",
    rail,
    children,
  }: {
    activeView: string;
    navItems: NavItem[];
    title: string;
    eyebrow: string;
    subline: string;
    previewStatus?: boolean;
    connectionState: ConnectionState;
    dataState: DataState;
    errorMessage: string | null;
    lastUpdated?: string | null;
    onViewChange: (view: string) => void;
    onRefresh: () => void;
    uxClass?: string;
    rail?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<div class={`app-shell ${uxClass}`}>
  <div class="page">
    <TopBar {title} {eyebrow} {subline} {previewStatus} {connectionState} {dataState} {errorMessage} {lastUpdated} {onRefresh} />
  </div>
  <nav class="module-nav page" aria-label="Core Contracts Bereiche">
    {#each navItems as item (item.id)}
      {@const Icon = item.icon}
      <button type="button" class:active={activeView === item.id} aria-current={activeView === item.id ? "page" : undefined} onclick={() => onViewChange(item.id)} title={item.hint}>
        <Icon size={17} aria-hidden="true" /><span>{item.label}</span>
      </button>
    {/each}
  </nav>
  {#if rail}<div class="page rail">{@render rail()}</div>{/if}
  <main class="content page" tabindex="-1">{@render children?.()}</main>
</div>

<style>
  .app-shell { display: flex; flex-direction: column; min-height: 100vh; min-width: 0; max-width: 100%; overflow-x: hidden; background: radial-gradient(circle at top right, var(--color-surface-elevated), transparent 36%), var(--color-background); }
  .page { box-sizing: border-box; width: 100%; max-width: 1540px; min-width: 0; margin: 0 auto; padding-inline: var(--space-8); }
  .app-shell.text-large { font-size: 112.5%; } .app-shell.text-xlarge { font-size: 125%; }
  .app-shell.density-compact :global(.content) { --space-6:16px; --space-4:12px; --space-3:8px; }
  .app-shell.density-compact :global(.data-table th), .app-shell.density-compact :global(.data-table td) { padding-block: 4px; }
  .app-shell.motion-reduce, .app-shell.motion-reduce :global(*) { scroll-behavior:auto!important; animation:none!important; transition:none!important; }
  .module-nav { display:flex; gap:var(--space-2); overflow-x:auto; padding-bottom:var(--space-3); border-bottom:1px solid var(--color-border); scrollbar-width:thin; }
  .module-nav button { display:flex; flex:0 0 auto; align-items:center; gap:var(--space-2); min-height:44px; padding:0 var(--space-3); border:1px solid transparent; border-radius:var(--radius-control); background:transparent; color:var(--color-text-secondary); }
  .module-nav button:hover { border-color:var(--color-border); color:var(--color-text-primary); }
  .module-nav button.active { border-color:var(--color-info-border); background:var(--color-info-subtle); color:var(--color-info-foreground); }
  .rail { padding-top: var(--space-4); }
  .content { display: grid; gap: var(--space-4); align-content: start; padding-top: var(--space-4); padding-bottom: var(--space-12); }
  @media (max-width: 860px) { .page { padding-inline: var(--space-6); } }
  @media (max-width: 560px) { .page { padding-inline: var(--space-4); } .content { padding-bottom: var(--space-8); } .module-nav button span { font-size:.75rem; } }
</style>
