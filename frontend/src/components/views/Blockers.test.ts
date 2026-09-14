// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ContractDetailView from './ContractDetailView.svelte';
import ContractsExplorer from './ContractsExplorer.svelte';
import GraphView from './GraphView.svelte';
import SettingsView from './SettingsView.svelte';
import SetupView from './SetupView.svelte';
import SourcesView from './SourcesView.svelte';
import { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
import type { RegistryPayload, RegistryView } from '../../lib/core-contracts/registry.svelte';

let component:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;document.body.innerHTML='';localStorage.clear();});
const button=(label:string)=>[...document.querySelectorAll('button')].find(item=>item.textContent?.includes(label)) as HTMLButtonElement;
const click=(element:HTMLElement)=>{element.click();flushSync();};
const activeView=(payload:RegistryPayload):RegistryView=>({registry:{profile:'benni',revision:{id:'r1',revision:1,profile:'benni',status:'active',created_at:'',payload},source:'postgres',health:'healthy',reason:null,used_last_known_good:false},revisions:[],requirements:[],history_error:null});

describe('release blocker flows',()=>{
  it('opens the independent full contract route from the inspector and renders all required sections',async()=>{
    const store=new CoreContractsStore();store.usePreview();
    const detail=vi.fn();
    component=mount(ContractsExplorer,{target:document.body,props:{store,onSelect:(id:string)=>store.selectContract(id),onDetail:detail,onTrace:vi.fn(),onEdit:vi.fn()}});
    flushSync();click(button('Vollständig öffnen'));
    expect(detail).toHaveBeenCalledWith('room.living');
    await unmount(component);component=mount(ContractDetailView,{target:document.body,props:{store,onBack:vi.fn(),onTrace:vi.fn()}});flushSync();
    for(const label of ['Überblick','Felder','Abhängigkeiten','Verwendung','Technische Details'])expect(document.body.textContent).toContain(label);
  });

  it('uses distinct binding and fusion records and exposes supported fusion actions',()=>{
    const store=new CoreContractsStore();store.usePreview();store.preferences.set('technicalNames',true);store.registry.setHass({user:{id:'admin',is_admin:true}});
    const editBinding=vi.fn(),editFusion=vi.fn();
    component=mount(SourcesView,{target:document.body,props:{store,onEditBinding:editBinding,onEditFusion:editFusion}});flushSync();
    expect(document.body.textContent).toContain('sensor.living_humidity');
    click(button('Zusammenführungen'));
    expect(document.body.textContent).toContain('fusion.living.temperature');
    expect(document.body.textContent).not.toContain('sensor.living_humidity');
    click(button('Ansehen'));expect(document.body.textContent).toContain('Eingänge');
    click(button('Zusammenführung anlegen'));expect(editFusion).toHaveBeenCalledWith();
    click(button('Bearbeiten'));expect(editFusion).toHaveBeenCalledWith('fusion.living.temperature');
  });

  it('offers an explicit focus and every graph mode without treating unknown as an error',()=>{
    const store=new CoreContractsStore();store.usePreview();
    component=mount(GraphView,{target:document.body,props:{store}});flushSync();
    expect(document.body.textContent).toContain('Fokuspunkt');
    for(const label of ['Nur aktuelle Entscheidung','Alle konfigurierten Pfade','Nur beeinträchtigte','Upstream','Downstream'])expect(document.body.textContent).toContain(label);
    expect(document.body.textContent).toContain('Unbekannt ist neutral');
    expect(document.querySelector('.status-badge.danger')?.textContent??'').not.toContain('Unbekannt');
  });

  it('applies persisted settings to explorer behavior and technical labels',()=>{
    const store=new CoreContractsStore();store.usePreview();
    component=mount(SettingsView,{target:document.body,props:{store}});flushSync();
    const selects=[...document.querySelectorAll('select')];
    selects[0].value='compact';selects[0].dispatchEvent(new Event('change',{bubbles:true}));
    selects[1].value='exact';selects[1].dispatchEvent(new Event('change',{bubbles:true}));
    selects[2].value='xlarge';selects[2].dispatchEvent(new Event('change',{bubbles:true}));
    selects[3].value='reduce';selects[3].dispatchEvent(new Event('change',{bubbles:true}));
    selects[4].value='last';selects[4].dispatchEvent(new Event('change',{bubbles:true}));
    selects[5].value='detail';selects[5].dispatchEvent(new Event('change',{bubbles:true}));
    const checkbox=document.querySelector('input[type=checkbox]') as HTMLInputElement;checkbox.click();flushSync();
    expect(store.preferences.shellClass).toBe('density-compact text-xlarge motion-reduce');
    expect(store.preferences.snapshot).toMatchObject({technicalNames:true,timeDisplay:'exact',startView:'last',openBehavior:'detail'});
    unmount(component);component=mount(ContractsExplorer,{target:document.body,props:{store,onSelect:vi.fn(),onDetail:vi.fn(),onTrace:vi.fn(),onEdit:vi.fn()}});flushSync();
    expect(document.body.textContent).toContain('room_climate');
    expect(document.querySelector('[aria-label="Vertrags-Inspector"]')).toBeNull();
  });

  it('links every setup finding to a concrete follow-up view',()=>{
    const store=new CoreContractsStore();store.usePreview();store.registry.setHass({user:{id:'admin',is_admin:true},states:{}});
    store.registry.view=activeView({profile:'benni',schema_version:2,bindings:[{binding_id:'b1',source_id:'s1',entity_id:'sensor.missing',field:'',capability:'',profile_id:'benni',required:true,freshness_ttl_seconds:300,consumer_ids:[],fallback:{action:'reject',default_value:null,reason:'missing'},read_only:true,display_name:'Fehlende Quelle'}],fusions:[],contract_instances:[],consumer_overrides:{},registry_metadata:{},devices:[{device_id:'d1',source_cadence:'event_based',cadence_provenance:{kind:'manual'}}]});
    const onBinding=vi.fn(),onDevice=vi.fn(),onContract=vi.fn();
    component=mount(SetupView,{target:document.body,props:{store,onBinding,onDevice,onContract}});flushSync();
    for(const label of ['Quelle einrichten','Entity ersetzen','Lebenszeichen festlegen','Vertragsfeld untersuchen'])expect(document.body.textContent).toContain(label);
    click(button('Quelle einrichten'));expect(onBinding).toHaveBeenCalledWith('b1');
    click(button('Entity ersetzen'));expect(onBinding).toHaveBeenCalledWith('b1');
    click(button('Lebenszeichen festlegen'));expect(onDevice).toHaveBeenCalledWith('d1');
    click(button('Vertragsfeld untersuchen'));expect(onContract).toHaveBeenCalled();
  });
});
