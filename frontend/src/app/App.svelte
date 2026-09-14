<script lang="ts">
  import { onMount } from "svelte";
  import { Boxes, Cable, GitBranch, LayoutDashboard, Settings, ShieldCheck, Smartphone, Workflow } from "@lucide/svelte";
  import AppShell from "../components/shell/AppShell.svelte";
  import DraftRail from "../components/shell/DraftRail.svelte";
  import OverviewView from "../components/views/OverviewView.svelte";
  import ContractsExplorer from "../components/views/ContractsExplorer.svelte";
  import TraceView from "../components/views/TraceView.svelte";
  import DomainView from "../components/views/DomainView.svelte";
  import RegistryView from "../components/views/RegistryView.svelte";
  import GraphView from "../components/views/GraphView.svelte";
  import type { CoreContractsStore, AppView } from "../lib/core-contracts/store.svelte";
  import type { NavItem } from "../components/shell/types";
  let { store }: { store: CoreContractsStore } = $props();
  const navItems: NavItem[] = [
    { id:"overview", label:"Übersicht", hint:"Status", icon:LayoutDashboard }, { id:"contracts", label:"Verträge", hint:"Explorer", icon:Boxes },
    { id:"sources", label:"Quellen", hint:"Zuordnung & Fusion", icon:Cable }, { id:"devices", label:"Geräte", hint:"Identität & Lebenszeichen", icon:Smartphone },
    { id:"graph", label:"Abhängigkeiten", hint:"Fokusgraph", icon:GitBranch }, { id:"setup", label:"Einrichtung prüfen", hint:"Funde", icon:ShieldCheck },
    { id:"changes", label:"Änderungen", hint:"Entwurf & Versionen", icon:Workflow }, { id:"settings", label:"Einstellungen", hint:"Darstellung & System", icon:Settings },
  ];
  const titles: Record<AppView,string> = { overview:"Übersicht", contracts:"Verträge", sources:"Quellen", devices:"Geräte", graph:"Abhängigkeiten", setup:"Einrichtung prüfen", changes:"Änderungen und Versionen", settings:"Einstellungen", trace:"Warum? – Trace" };
  function route(view:AppView,contract?:string,field?:string,replace=false){store.setView(view);if(contract)store.selectContract(contract);if(field)store.selectedField=field;const q=new URLSearchParams();if(contract)q.set("contract",contract);if(field)q.set("field",field);const hash=`#/${view}${q.size?`?${q}`:""}`;if(location.hash!==hash)history[replace?"replaceState":"pushState"](null,"",hash);}
  function readRoute(){const [path,queryText]=location.hash.replace(/^#\/?/,"").split("?");const allowed=["overview","contracts","sources","devices","graph","setup","changes","settings","trace"];const view=(allowed.includes(path)?path:"overview") as AppView;const q=new URLSearchParams(queryText??"");store.setView(view);store.selectedContractId=q.get("contract")??store.selectedContractId;store.selectedField=q.get("field");}
  onMount(()=>{readRoute();addEventListener("popstate",readRoute);const preview=import.meta.env.DEV&&new URLSearchParams(location.search).get("preview")==="fixture";if(preview)store.usePreview();else store.start();return()=>{removeEventListener("popstate",readRoute);store.stop();};});
</script>
<svelte:window onbeforeunload={(event)=>{if(store.registry.dirty||store.registry.importText){event.preventDefault();event.returnValue="";}}}/>
<AppShell activeView={store.activeView} {navItems} title={titles[store.activeView]} eyebrow="Core Contracts" subline={store.previewMode?"Lokale Vorschau · nicht live":`${store.registry.profile} · Registry & Exchange`} search={store.search} searchLabel="Aktuelle Ansicht durchsuchen" searchPlaceholder="Suchen …" previewStatus={store.previewMode} connectionState={store.connectionState} errorMessage={store.errorMessage} onViewChange={(view)=>route(view as AppView)} onSearch={(value)=>store.setSearch(value)} onRefresh={()=>{void store.refresh();if(["sources","devices","changes","settings"].includes(store.activeView))void store.registry.refresh();}} scopeLabel="Registry & Exchange" scopeHint="Entwurf vor Aktivierung" versionLabel="UX V1">
  {#snippet children()}<DraftRail {store} onOpen={()=>route("changes")}/>{#if store.activeView==="overview"}<OverviewView {store}/>{:else if store.activeView==="contracts"}<ContractsExplorer {store} onOpen={(id)=>route("contracts",id)} onTrace={(id,field)=>route("trace",id,field)} onEdit={()=>route("changes")}/>{:else if store.activeView==="trace"}<TraceView {store} onBack={()=>route("contracts",store.selectedContractId??undefined)}/>{:else if store.activeView==="graph"}<GraphView {store}/>{:else if store.activeView==="changes"}<RegistryView {store}/>{:else}<DomainView {store} view={store.activeView}/>{/if}{/snippet}
</AppShell>
