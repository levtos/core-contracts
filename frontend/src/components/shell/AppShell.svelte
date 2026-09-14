<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ConnectionState } from "../../lib/ui/state";
  import type { NavItem } from "./types";
  import TopBar from "./TopBar.svelte";

  let {
    activeView,
    navItems,
    title,
    eyebrow,
    subline,
    search,
    searchLabel,
    searchPlaceholder,
    previewStatus,
    connectionState,
    errorMessage,
    onViewChange,
    onSearch,
    onRefresh,
    scopeLabel,
    scopeHint,
    versionLabel,
    uxClass = "",
    children,
  }: {
    activeView: string;
    navItems: NavItem[];
    title: string;
    eyebrow: string;
    subline: string;
    search: string;
    searchLabel?: string;
    searchPlaceholder?: string;
    previewStatus?: boolean;
    connectionState: ConnectionState;
    errorMessage: string | null;
    onViewChange: (view: string) => void;
    onSearch: (value: string) => void;
    onRefresh: () => void;
    scopeLabel?: string;
    scopeHint?: string;
    versionLabel?: string;
    uxClass?: string;
    children?: Snippet;
  } = $props();
</script>

<div class={`app-shell ${uxClass}`}>
  <div class="workspace">
    <TopBar
      {title}
      {eyebrow}
      {subline}
      {search}
      {searchLabel}
      {searchPlaceholder}
      connectionState={previewStatus ? "connected" : connectionState}
      status={previewStatus ? "unknown" : connectionState === "connected" ? "healthy" : connectionState}
      statusLabel={previewStatus ? "Preview" : connectionState === "connected" ? "Live verbunden" : connectionState}
      {errorMessage}
      {onSearch}
      {onRefresh}
    />
    <nav class="module-nav" aria-label="Core Contracts Bereiche">
      {#each navItems as item (item.id)}
        {@const Icon = item.icon}
        <button type="button" class:active={activeView === item.id} aria-current={activeView === item.id ? "page" : undefined} onclick={() => onViewChange(item.id)}>
          <Icon size={17} /><span>{item.label}</span>
        </button>
      {/each}
    </nav>
    <main class="content" tabindex="-1">{@render children?.()}</main>
  </div>
</div>

<style>
  .app-shell { display: flex; min-height: 100vh; background: radial-gradient(circle at top right, var(--color-surface-elevated), transparent 36%), var(--color-background); }
  .workspace { display: flex; flex: 1; min-width: 0; flex-direction: column; }
  .app-shell.text-large { font-size: 112.5%; } .app-shell.text-xlarge { font-size: 125%; }
  .app-shell.density-compact :global(.content) { --space-6:16px; --space-4:12px; --space-3:8px; }
  .app-shell.density-compact :global(article) { padding-block:var(--space-2); }
  .app-shell.motion-reduce, .app-shell.motion-reduce :global(*) { scroll-behavior:auto!important; animation:none!important; transition:none!important; }
  .module-nav { display:flex; gap:var(--space-2); overflow-x:auto; padding:0 var(--space-8) var(--space-4); border-bottom:1px solid var(--color-border); scrollbar-width:thin; }
  .module-nav button { display:flex; flex:0 0 auto; align-items:center; gap:var(--space-2); min-height:44px; padding:0 var(--space-3); border:1px solid transparent; border-radius:var(--radius-control); background:transparent; color:var(--color-text-secondary); }
  .module-nav button:hover { border-color:var(--color-border); color:var(--color-text-primary); }
  .module-nav button.active { border-color:var(--color-info-border); background:var(--color-info-subtle); color:var(--color-info-foreground); }
  .content { width: 100%; max-width: 1540px; margin: 0 auto; padding: 0 var(--space-8) var(--space-12); }
  @media (max-width: 860px) { .content { padding-inline: var(--space-6); } .module-nav { padding-inline:var(--space-6); } }
  @media (max-width: 560px) { .content { padding-inline: var(--space-4); padding-bottom: var(--space-8); } .module-nav { padding-inline:var(--space-4); } .module-nav button span { font-size:.75rem; } }
</style>
