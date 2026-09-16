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
  import DevicesView from '../components/views/DevicesView.svelte';
  import ProblemsView from '../components/views/ProblemsView.svelte';
  import SettingsView from '../components/views/SettingsView.svelte';
  import ChangesView from '../components/views/ChangesView.svelte';
  import GraphView from '../components/views/GraphView.svelte';
  import BindingDialog from '../components/dialogs/BindingDialog.svelte';
  import FusionDialog from '../components/dialogs/FusionDialog.svelte';
  import ContractDialog from '../components/dialogs/ContractDialog.svelte';
  import DeviceDialog from '../components/dialogs/DeviceDialog.svelte';
  import { parseRoute, routeHash, type AppRoute } from '../lib/core-contracts/routing';
  import { filterFromQuery, filterToQuery } from '../lib/core-contracts/listing';
  import type { ProblemAction } from '../lib/core-contracts/problems';
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
      if (store.sourceTab === 'bindings') { store.sourceFilter = filterFromQuery(query); store.selectedBindingId = query.id ?? null; }
      else { store.fusionFilter = filterFromQuery(query); store.selectedFusionId = query.id ?? null; }
    }
    if (next.view === 'contracts') store.contractFilter = filterFromQuery(query);
    if (next.view === 'devices') { store.deviceFilter = filterFromQuery(query); store.selectedDeviceId = query.id ?? null; }
    if (next.view === 'graph') { if (query.focus) store.graphFocus = query.focus; if (query.mode) store.graphMode = query.mode as typeof store.graphMode; }
  }
  /** State → route query for the current view. */
  function currentQuery(): Record<string, string> {
    if (store.activeView === 'sources') {
      const bindings = store.sourceTab === 'bindings';
      return { ...(bindings ? {} : { tab: 'fusions' }), ...filterToQuery(bindings ? store.sourceFilter : store.fusionFilter), ...(bindings && store.selectedBindingId ? { id: store.selectedBindingId } : !bindings && store.selectedFusionId ? { id: store.selectedFusionId } : {}) };
    }
    if (store.activeView === 'contracts') return filterToQuery(store.contractFilter);
    if (store.activeView === 'devices') return { ...filterToQuery(store.deviceFilter), ...(store.selectedDeviceId ? { id: store.selectedDeviceId } : {}) };
    if (store.activeView === 'graph') return { ...(store.graphFocus ? { focus: store.graphFocus } : {}), ...(store.graphMode !== 'current' ? { mode: store.graphMode } : {}) };
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

  function editBinding(id?: string) {
    route('sources', undefined, undefined, false, { ...(id ? { id } : {}) });
    store.sourceTab = 'bindings';
    const binding = id ? store.registry.bindings.find((item) => item.binding_id === id) ?? null : null;
    if (id) store.selectedBindingId = id;
    store.registry.select(binding);
  }
  function editFusion(id?: string) { route('sources', undefined, undefined, false, { tab: 'fusions', ...(id ? { id } : {}) }); store.sourceTab = 'fusions'; if (id) store.selectedFusionId = id; store.registry.selectFusion(id ? store.registry.fusions.find((item) => item.fusion_id === id) ?? null : null); }
  function editDevice(id: string) { route('devices', undefined, undefined, false, { id }); store.selectedDeviceId = id; const device = store.registry.devices.find((item) => item.device_id === id) ?? null; if (device) store.registry.selectDevice(device); }
  function openSource(id: string) { route('sources', undefined, undefined, false, { id }); store.sourceTab = 'bindings'; store.selectedBindingId = id; }
  function openFusion(id: string) { route('sources', undefined, undefined, false, { tab: 'fusions', id }); store.sourceTab = 'fusions'; store.selectedFusionId = id; }
  function runProblemAction(action: ProblemAction) {
    if (action.kind === 'edit_binding') editBinding(action.bindingId);
    else if (action.kind === 'edit_device') editDevice(action.deviceId);
    else if (action.kind === 'edit_fusion') editFusion(action.fusionId);
    else if (action.kind === 'trace') route('trace', action.contractId, action.field);
    else if (action.kind === 'contract') route('contract', action.contractId);
    else if (action.kind === 'changes') route('changes');
    else route('sources');
  }
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
    {#if store.activeView === 'overview'}<OverviewView {store} onProblems={() => route('problems')} onProblem={runProblemAction} onContract={(id) => route('contract', id)} />
    {:else if store.activeView === 'contracts'}<ContractsExplorer {store} onSelect={(id) => route('contracts', id)} onDetail={(id) => route('contract', id)} onTrace={(id, field) => route('trace', id, field)} />
    {:else if store.activeView === 'contract'}<ContractDetailView {store} onBack={() => route('contracts', store.selectedContractId ?? undefined)} onTrace={(id, field) => route('trace', id, field)} onSource={openSource} onFusion={openFusion} />
    {:else if store.activeView === 'trace'}<TraceView {store} onBack={() => route('contract', store.selectedContractId ?? undefined)} onSource={openSource} />
    {:else if store.activeView === 'sources'}<SourcesView {store} onTrace={(id, field) => route('trace', id, field)} />
    {:else if store.activeView === 'devices'}<DevicesView {store} onSource={openSource} />
    {:else if store.activeView === 'graph'}<GraphView {store} onTrace={(id, field) => route('trace', id, field)} onSource={openSource} />
    {:else if store.activeView === 'problems'}<ProblemsView {store} onAction={runProblemAction} />
    {:else if store.activeView === 'settings'}<SettingsView {store} />
    {:else}<ChangesView {store} />{/if}
  {/snippet}
</AppShell>
{#if store.registry.dialog === 'binding'}<BindingDialog {store} />
{:else if store.registry.dialog === 'fusion'}<FusionDialog {store} />
{:else if store.registry.dialog === 'contract'}<ContractDialog {store} />
{:else if store.registry.dialog === 'device'}<DeviceDialog {store} />{/if}
