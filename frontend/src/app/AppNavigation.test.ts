// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import App from './App.svelte';
import { CoreContractsStore } from '../lib/core-contracts/store.svelte';

let component:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;history.replaceState(null,'','#/');document.body.innerHTML='';localStorage.clear();});
const settle=async()=>{await new Promise(resolve=>setTimeout(resolve,0));await tick();flushSync();};
const navigate=async(direction:'back'|'forward')=>{const popped=new Promise<void>(resolve=>addEventListener('popstate',()=>resolve(),{once:true}));history[direction]();await popped;await settle();};

describe('application history routing',()=>{
  it('opens a direct detail URL and restores explorer state through browser back and forward',async()=>{
    history.replaceState(null,'','#/contracts?contract=room.living&status=degraded&sort=schema');
    history.pushState(null,'','#/contract?contract=room.living');
    const store=new CoreContractsStore();store.usePreview();
    component=mount(App,{target:document.body,props:{store}});await settle();
    expect(store.activeView).toBe('contract');
    expect(document.body.textContent).toContain('Technische Details');
    await navigate('back');
    expect(store.activeView).toBe('contracts');
    expect(store.contractFilter.status).toBe('degraded');expect(store.contractFilter.sort).toBe('schema');
    await navigate('forward');
    expect(store.activeView).toBe('contract');
  });
});
