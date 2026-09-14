// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ContractsExplorer from './ContractsExplorer.svelte';
import TraceView from './TraceView.svelte';
import { CoreContractsStore } from '../../lib/core-contracts/store.svelte';

let component:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;document.body.innerHTML='';});
describe('Core Contracts UX V1',()=>{
  it('keeps unknown neutral and exposes inspector and Why action',()=>{
    const store=new CoreContractsStore(); store.usePreview();
    const first=store.contracts[0]; first.field_states[Object.keys(first.values)[0]]='unknown';
    component=mount(ContractsExplorer,{target:document.body,props:{store,onOpen:(id:string)=>store.selectContract(id),onTrace:(id:string,field:string)=>store.openTrace(id,field),onEdit:()=>store.setView('changes')}});flushSync();
    expect(document.body.textContent).toContain('Verträge');
    expect(document.body.textContent).toContain('Warum?');
    expect(document.querySelector('.danger')?.textContent).not.toContain('Unbekannt');
  });
  it('renders a plain-language trace with candidates and technical details',()=>{
    const store=new CoreContractsStore(); store.usePreview();
    store.selectedField=Object.keys(store.selectedContract?.values??{})[0]??null;
    component=mount(TraceView,{target:document.body,props:{store,onBack:()=>undefined}});flushSync();
    expect(document.body.textContent).toContain('Aktuelles Ergebnis');
    expect(document.body.textContent).toContain('Kandidaten');
    expect(document.body.textContent).toContain('Entscheidung');
    expect(document.querySelector('details')).not.toBeNull();
  });
});
