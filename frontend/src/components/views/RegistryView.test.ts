// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import RegistryView from './RegistryView.svelte';
import { CoreContractsStore } from '../../lib/core-contracts/store.svelte';

let component: ReturnType<typeof mount> | undefined;
afterEach(async () => { if (component) await unmount(component); document.body.innerHTML=''; });
function show(admin = true) {
  const store = new CoreContractsStore();
  store.registry.setHass({user:{id:'u',is_admin:admin},states:{'sensor.real':{entity_id:'sensor.real',attributes:{friendly_name:'Reale HA Entity'}}}});
  component = mount(RegistryView, {target:document.body, props:{store}}); flushSync();
  return store;
}
describe('Registry component', () => {
  it('renders admin actions and opens the binding dialog instead of an inline form', () => {
    const store = show(); flushSync(() => store.registry.select(null));
    expect(document.body.textContent).toContain('Speichern');
    expect(store.registry.dialog).toBe('binding');
    expect(document.querySelector('form')).toBeNull();
    expect(document.body.textContent).toContain('Ungespeicherte Änderungen');
  });
  it('hides writes for non-admin while retaining the profile and refresh controls', () => {
    show(false); const text=document.body.textContent;
    expect(text).toContain('Read-only'); expect(text).toContain('Aktualisieren');
    expect(text).not.toContain('Binding anlegen'); expect(text).not.toContain('Änderungen verwerfen');
  });
  it('renders fusion strategy and explicit input selection without a write on opening',()=>{
    const store=show(); flushSync(()=>store.registry.selectFusion(null));
    expect(document.body.textContent).toContain('Fusion in Entwurf übernehmen');
    expect(document.querySelector('option[value="all_true"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Fusion-Inputs');
    expect(store.registry.draft).toBeNull();
  });
});
