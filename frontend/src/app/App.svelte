<script lang="ts">
  import { onMount } from 'svelte';
  import { Boxes, Cable, GitBranch, LayoutDashboard, Settings, ShieldAlert, Smartphone, Workflow } from '@lucide/svelte';
  import AppShell from '../components/shell/AppShell.svelte';
  import VersionBar from '../components/shell/VersionBar.svelte';
  import OverviewView from '../components/views/OverviewView.svelte';
  import ContractsExplorer from '../components/views/ContractsExplorer.svelte';
  import ContractDetailView from '../components/views/ContractDetailView.svelte';
  import TraceView from '../components/views/TraceView.svelte';
  import SourcesView from '../components/views/SourcesView.svelte';
  import SetupView from '../components/views/SetupView.svelte';
  import SettingsView from '../components/views/SettingsView.svelte';
  import DomainView from '../components/views/DomainView.svelte';
  import RegistryView from '../components/views/RegistryView.svelte';
  import GraphView from '../components/views/GraphView.svelte';
  import BindingDialog from '../components/dialogs/BindingDialog.svelte';
  import { parseRoute, routeHash, type AppRoute } from '../lib/core-contracts/routing';
  import { filterFromQuery, filterToQuery } from '../lib/core-contracts/listing';
  import type { CoreContractsStore, AppView } from '../lib/core-contracts/store.svelte';
  import type { NavItem } from '../components/shell/types';

  let { store }: { store: CoreContractsStore } = $props();
  const navItems: NavItem[] = [
    { id: 'overview', label: 'Übersicht', hint: 'Systemzustand und Einstieg', icon: LayoutDashboard },
    { id: 'contracts', label: 'Verträge', hint: 'Explorer, Inspector und Detail', icon: Boxes },
    { id: 'sources', label: 'Quellen', hint: 'Quellenzuordnungen und Zusammenführungen', icon: Cable },
    { id: 'devices', label: 'Geräte', hint: 'Gerätebestand und Lebenszeichen', icon: Smartphone },
    { id: 'graph', label: 'Abhängigkeiten', hint: 'Fokussierter Graph', icon: GitBranch },
    { id: 'problems', label: 'Aktuelle Probleme', hint: 'Laufende Fehler- und Problemübersicht', icon: ShieldAlert },
    { id: 'changes', label: 'Änderungen', hint: 'Entwurf, Diff, Versionen', icon: Workflow },
    { id: 'settings', label: 'Einstellungen', hint: 'Darstellung und System', icon: Settings },
  ];
  const titles: Record<AppView, string> = { overview: 'Übersicht', contracts: 'Verträge', contract: 'Vertragsdetail', sources: 'Quellen', devices: 'Geräte', graph: 'Abhängigkeiten', problems: 'Aktuelle Probleme', changes: 'Änderungen und Versionen', settings: 'Einstellungen', trace: 'Warum? – Entscheidung erklären' };

  /** Route → state. Search and filter state of the list views live in the URL query. */
  function applyRoute(next: AppRoute) {
    store.setView(next.view);
    store.selectedContractId = next.contract ?? (next.view === 'contracts' ? store.selectedContractId : null);
    store.selectedField = next.field ?? null;
    const query = next.query ?? {};
    if (next.view === 'sources') {
      store.sourceTab = query.tab === 'fusions' ? 'fusions' : 'bindings';
      if (store.sourceTab === 'bindings') store.sourceFilter = filterFromQuery(query); else store.fusionFilter = filterFromQuery(query);
      store.selectedBindingId = store.sourceTab === 'bindings' ? query.id ?? null : store.selectedBindingId;
      store.selectedFusionId = store.sourceTab === 'fusions' ? query.id ?? null : store.selectedFusionId;
    }
    if (next.view === 'contracts') store.contractFilter = filterFromQuery(query);
    if (next.view === 'devices') { store.deviceFilter = filterFromQuery(query); store.selectedDeviceId = query.id ?? null; }
  }
  /** State → route query for the current list view. */
  function currentQuery(): Record<string, string> {
    if (store.activeView === 'sources') {
      const bindings = store.sourceTab === 'bindings';
      return { ...(bindings ? {} : { tab: 'fusions' }), ...filterToQuery(bindings ? store.sourceFilter : store.fusionFilter), ...(bindings && store.selectedBindingId ? { id: store.selectedBindingId } : !bindings && store.selectedFusionId ? { id: store.selectedFusionId } : {}) };
    }
    if (store.activeView === 'contracts') return filterToQuery(store.contractFilter);
    if (store.activeView === 'devices') return { ...filterToQuery(store.deviceFilter), ...(store.selectedDeviceId ? { id: store.selectedDeviceId } : {}) };
    return {};
  }
  function route(view: AppView, contract?: string, field?: string, replace = false, query?: Record<string, string>) {
    const next: AppRoute = { view, contract, field, query };
    applyRoute(next);
    const hash = routeHash(next);
    if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
  }
  function readRoute() { const fallback = store.preferences.initialView as AppView; applyRoute(parseRoute(location.hash, fallback)); }
  let mounted = $state(false);
  $effect(() => {
    if (!mounted) return;
    const query = currentQuery();
    const hash = routeHash({ view: store.activeView, contract: store.activeView === 'contracts' || store.activeView === 'contract' || store.activeView === 'trace' ? store.selectedContractId ?? undefined : undefined, field: store.activeView === 'trace' ? store.selectedField ?? undefined : undefined, query });
    if (location.hash !== hash && parseRoute(location.hash).view === store.activeView) history.replaceState(null, '', hash);
  });
  /** Until the fusion and contract dialogs exist, their editors still live on the changes view. */
  $effect(() => { if ((store.registry.dialog === 'fusion' || store.registry.dialog === 'contract') && store.activeView !== 'changes') route('changes'); });

  function editBinding(id?: string) {
    route('sources', undefined, undefined, false, { ...(id ? { id } : {}) });
    store.sourceTab = 'bindings';
    const binding = id ? store.registry.bindings.find((item) => item.binding_id === id) ?? null : null;
    if (id) store.selectedBindingId = id;
    store.registry.select(binding);
  }
  function editFusion(id?: string) { route('sources', undefined, undefined, false, { tab: 'fusions', ...(id ? { id } : {}) }); store.sourceTab = 'fusions'; store.registry.selectFusion(id ? store.registry.fusions.find((item) => item.fusion_id === id) ?? null : null); }
  function editDevice(id: string) { const binding = store.registry.bindings.find((item) => item.device_id === id); if (binding) editBinding(binding.binding_id); else route('devices', undefined, undefined, false, { id }); }
  onMount(() => {
    readRoute(); mounted = true;
    addEventListener('popstate', readRoute); addEventListener('hashchange', readRoute);
    const preview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'fixture';
    if (preview) store.usePreview(); else store.start();
    return () => { removeEventListener('popstate', readRoute); removeEventListener('hashchange', readRoute); store.stop(); };
  });
</script>

<svelte:window onbeforeunload={(event) => { if (store.registry.dirty || store.registry.importText) { event.preventDefault(); event.returnValue = ''; } }} />
<AppShell activeView={store.activeView} {navItems} title={titles[store.activeView]} eyebrow="Core Contracts" subline={store.previewMode ? 'Lokale Vorschau · nicht live' : `Profil ${store.registry.profile === 'eltern' ? 'Eltern' : 'Benni'} · Registry & Exchange`} previewStatus={store.previewMode} connectionState={store.connectionState} dataState={store.dataState} errorMessage={store.errorMessage} lastUpdated={store.lastUpdated} onViewChange={(view) => route(view as AppView)} onRefresh={() => { void store.refresh(); void store.registry.refresh(); }} uxClass={store.preferences.shellClass}>
  {#snippet rail()}<VersionBar {store} onOpenChanges={() => route('changes')} />{/snippet}
  {#snippet children()}
    {#if store.activeView === 'overview'}<OverviewView {store} />
    {:else if store.activeView === 'contracts'}<ContractsExplorer {store} onSelect={(id) => route('contracts', id)} onDetail={(id) => route('contract', id)} onTrace={(id, field) => route('trace', id, field)} onEdit={() => route('changes')} />
    {:else if store.activeView === 'contract'}<ContractDetailView {store} onBack={() => route('contracts', store.selectedContractId ?? undefined)} onTrace={(id, field) => route('trace', id, field)} />
    {:else if store.activeView === 'trace'}<TraceView {store} onBack={() => route('contract', store.selectedContractId ?? undefined)} />
    {:else if store.activeView === 'sources'}<SourcesView {store} onTrace={(id, field) => route('trace', id, field)} />
    {:else if store.activeView === 'graph'}<GraphView {store} />
    {:else if store.activeView === 'problems'}<SetupView {store} onBinding={editBinding} onDevice={editDevice} onContract={(id, field) => (field ? route('trace', id, field) : route('contract', id))} />
    {:else if store.activeView === 'settings'}<SettingsView {store} />
    {:else if store.activeView === 'changes'}<RegistryView {store} />
    {:else}<DomainView {store} view={store.activeView} />{/if}
  {/snippet}
</AppShell>
{#if store.registry.dialog === 'binding'}<BindingDialog {store} />{/if}
