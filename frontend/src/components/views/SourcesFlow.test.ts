// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import App from '../../app/App.svelte';
import { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
import { createFakeBackend } from '../../lib/core-contracts/test-backend';

let component: ReturnType<typeof mount> | undefined;
let store: CoreContractsStore | undefined;
afterEach(async () => { store?.stop(); if (component) await unmount(component); component = undefined; store = undefined; history.replaceState(null, '', '#/'); document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks(); });

const settle = async () => { for (let i = 0; i < 4; i += 1) { await new Promise((resolve) => setTimeout(resolve, 0)); await tick(); } flushSync(); };
const text = () => document.body.textContent ?? '';
const button = (label: string, root: ParentNode = document) => [...root.querySelectorAll('button')].find((item) => (item.textContent ?? '').includes(label) || item.getAttribute('aria-label') === label) as HTMLButtonElement;
const click = async (element: HTMLElement | undefined) => { expect(element, 'element to click').toBeTruthy(); element!.click(); await settle(); };
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const setValue = async (input: HTMLInputElement | HTMLSelectElement, value: string) => { input.value = value; input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); await settle(); };

async function openSources(backend = createFakeBackend()) {
  history.replaceState(null, '', '#/sources');
  store = new CoreContractsStore();
  store.setHass(backend.hass);
  component = mount(App, { target: document.body, props: { store } });
  await settle();
  await vi.waitFor(() => { expect(store!.connectionState).toBe('connected'); expect(store!.registry.view).not.toBeNull(); });
  await settle();
  return { backend, store: store! };
}

describe('Quellen: bestehende Quelle erhält Gerätebezug und Kadenz (Abnahmepfad Abschnitt 7)', () => {
  it('walks from a legacy source through proposal, explicit confirmation, draft, validation and activation until the contract is no longer blocked', async () => {
    const { backend, store } = await openSources();
    const calls = () => backend.calls.map((item) => String(item.type));
    // 1. The legacy source is visible in the table without device.
    expect(store.contracts.find((item) => item.contract_id === 'opening.front_door')?.health).toBe('blocked');
    const table = document.querySelector('table[aria-label="Quellenzuordnungen"]') as HTMLTableElement;
    expect(table).toBeTruthy();
    const row = [...table.querySelectorAll('tbody tr')].find((item) => item.textContent?.includes('Haustür Kontakt')) as HTMLTableRowElement;
    expect(row.textContent).toContain('Kein Gerätebezug');
    expect(row.textContent).toContain('Blockiert');
    // 2. The pencil opens the full dialog.
    await click(button('Quelle Haustür Kontakt bearbeiten', row));
    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain('Quelle bearbeiten: Haustür Kontakt');
    expect(dialog()!.textContent).toContain('Kein Gerätebezug');
    expect(dialog()!.textContent).not.toContain('kein Gerätebezug (Legacy-Verhalten)');
    // 3./4. The proposal is requested explicitly and shows its origin.
    await click(button('Vorschlag für binary_sensor.front_door_contact prüfen', dialog()!));
    expect(dialog()!.textContent).toContain('Haustür Sensor');
    expect(dialog()!.textContent).toContain('vorgeschlagen aufgrund der Entity-Registry-Verknüpfung');
    expect(dialog()!.textContent).toContain('vorgeschlagen aufgrund des Labels contact_sensor');
    // 5. Nothing is applied automatically.
    expect(store.registry.editor?.device_id).toBeUndefined();
    expect(store.registry.stagedDevice).toBeNull();
    expect(calls()).not.toContain('benni_core_contracts/registry/device/create');
    // 6. Another compatible device is offered as alternative.
    expect(dialog()!.textContent).toContain('Anderes Gerät wählen');
    expect([...dialog()!.querySelectorAll('option')].some((item) => item.textContent?.includes('Multisensor'))).toBe(true);
    // 7. Cadence, liveness and interval are set explicitly.
    const cadence = [...dialog()!.querySelectorAll('select')].find((item) => [...item.options].some((option) => option.textContent?.includes('(vorgeschlagen)'))) as HTMLSelectElement;
    await setValue(cadence, 'event_based');
    const interval = [...dialog()!.querySelectorAll('input[type="number"]')].find((item) => (item as HTMLInputElement).value === '172800') as HTMLInputElement;
    await setValue(interval, '86400');
    await click(button('Vorschlag ausdrücklich übernehmen', dialog()!));
    expect(store.registry.stagedDevice).toMatchObject({ device_id: 'device-front-door', source_cadence: 'event_based', expected_interval_s: 86400, liveness_entity: 'sensor.front_door_last_seen', cadence_provenance: { kind: 'label', label_id: 'contact_sensor' } });
    expect(store.registry.editor?.device_id).toBe('device-front-door');
    expect(dialog()!.textContent).toContain('bestätigt, noch nicht gespeichert');
    expect(dialog()!.textContent).toContain('Nur bei Ereignis');
    expect(calls()).not.toContain('benni_core_contracts/registry/device/create');
    expect(store.registry.draft).toBeNull();
    // 8. Save writes device and binding into the draft, nothing more.
    await click(button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(dialog()).toBeNull();
    expect(calls()).toContain('benni_core_contracts/registry/device/create');
    expect(calls()).toContain('benni_core_contracts/registry/binding/update');
    expect(calls()).not.toContain('benni_core_contracts/registry/draft/save');
    expect(store.registry.changeCount).toBe(2);
    expect(backend.active.revision).toBe(1);
    expect(text()).toContain('2 Änderungen');
    // 9. Validation shows a result and the affected contract.
    await click(button('Prüfen'));
    expect(calls()).toContain('benni_core_contracts/registry/draft/validate');
    expect(store.registry.validation?.valid).toBe(true);
    expect(text()).toContain('Erfolgreich');
    expect(backend.active.revision).toBe(1);
    // 10. Explicit activation creates the new active revision.
    await click(button('Speichern und aktivieren'));
    expect(dialog()).not.toBeNull();
    await click(button('Speichern und aktivieren', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(calls()).toContain('benni_core_contracts/registry/draft/save');
    expect(backend.active.revision).toBe(2);
    expect(backend.active.payload.devices?.some((item) => item.device_id === 'device-front-door')).toBe(true);
    expect(backend.active.payload.bindings.find((item) => item.binding_id === 'binding.front-door')?.device_id).toBe('device-front-door');
    // 11. The previously blocked contract is not blocked any more.
    await vi.waitFor(() => expect(store.contracts.find((item) => item.contract_id === 'opening.front_door')?.health).toBe('healthy'));
    await settle();
    expect(store.registry.changeCount).toBe(0);
    expect(text()).toContain('Version 2 aktiviert');
    const updatedRow = [...document.querySelectorAll('table[aria-label="Quellenzuordnungen"] tbody tr')].find((item) => item.textContent?.includes('Haustür Kontakt'))!;
    expect(updatedRow.textContent).toContain('Haustür Sensor');
    expect(updatedRow.textContent).toContain('Gesund');
  });

  it('cancels a dialog without any write and keeps the draft untouched', async () => {
    const { backend } = await openSources();
    await click(button('Quelle Haustür Kontakt bearbeiten'));
    const name = dialog()!.querySelector('input[data-autofocus]') as HTMLInputElement;
    expect(document.activeElement).toBe(name);
    await setValue(name, 'Verändert, aber nicht gespeichert');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await click(button('Abbrechen', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(dialog()).toBeNull();
    expect(backend.calls.some((item) => String(item.type).includes('/registry/draft/create'))).toBe(false);
    expect(backend.calls.some((item) => String(item.type).includes('/registry/binding/'))).toBe(false);
    expect(text()).toContain('Haustür Kontakt');
    expect(text()).not.toContain('Verändert, aber nicht gespeichert');
  });

  it('closes on Escape and never persists on plain field input', async () => {
    const { backend, store } = await openSources();
    await click(button('Quelle Haustür Kontakt bearbeiten'));
    const name = dialog()!.querySelector('input[data-autofocus]') as HTMLInputElement;
    await setValue(name, 'Tippen ohne Speichern');
    expect(store.registry.formDirty).toBe(true);
    expect(backend.calls.filter((item) => String(item.type).includes('/registry/') && !String(item.type).endsWith('/view'))).toHaveLength(0);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(dialog()).toBeNull();
    expect(store.registry.formDirty).toBe(false);
  });
});

describe('Quellen: externe Änderungen während ein Dialog offen ist', () => {
  it('keeps the form, updates other rows, reports a conflict on the same entry and lets the user decide', async () => {
    const { backend, store } = await openSources();
    await click(button('Quelle Haustür Kontakt bearbeiten'));
    const name = dialog()!.querySelector('input[data-autofocus]') as HTMLInputElement;
    await setValue(name, 'Meine Eingabe');
    // An update of another entry arrives: the table changes, the form does not.
    backend.activateExternally((payload) => { payload.bindings.find((item) => item.binding_id === 'binding.living.temperature')!.display_name = 'Wohnzimmer Temperatur NEU'; });
    await store.registry.poll(); await settle();
    expect(text()).toContain('Wohnzimmer Temperatur NEU');
    expect(name.value).toBe('Meine Eingabe');
    expect(store.registry.externalChange).toBe(false);
    expect(dialog()!.textContent).not.toContain('extern geändert');
    // Now the same entry changes externally.
    backend.activateExternally((payload) => { payload.bindings.find((item) => item.binding_id === 'binding.front-door')!.freshness_ttl_seconds = 999; });
    await store.registry.poll(); await settle();
    expect(store.registry.externalChange).toBe(true);
    expect(dialog()!.textContent).toContain('extern geändert');
    expect(name.value).toBe('Meine Eingabe');
    const save = button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement);
    expect(save.disabled).toBe(true);
    // Decision A: load the external data (own input is dropped explicitly).
    await click(button('Aktuelle Daten laden', dialog()!));
    expect((dialog()!.querySelector('input[data-autofocus]') as HTMLInputElement).value).toBe('Haustür Kontakt');
    expect(store.registry.editor?.freshness_ttl_seconds).toBe(999);
    expect(store.registry.externalChange).toBe(false);
    // Decision B: keep own input and save deliberately.
    await setValue(dialog()!.querySelector('input[data-autofocus]') as HTMLInputElement, 'Meine zweite Eingabe');
    backend.activateExternally((payload) => { payload.bindings.find((item) => item.binding_id === 'binding.front-door')!.freshness_ttl_seconds = 1234; });
    await store.registry.poll(); await settle();
    expect(store.registry.externalChange).toBe(true);
    await click(button('Meine Eingaben behalten', dialog()!));
    expect(store.registry.externalChange).toBe(false);
    expect(text()).toContain('nur dieser Eintrag erhält Ihre Werte');
    await click(button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(dialog()).toBeNull();
    expect(store.registry.draft?.base_revision).toBe(4);
    expect(store.registry.draft?.payload.bindings.find((item) => item.binding_id === 'binding.front-door')).toMatchObject({ display_name: 'Meine zweite Eingabe', freshness_ttl_seconds: 999 });
    expect(backend.active.revision).toBe(4);
  });
});

describe('Quellen: Suche, Filter und Darstellung', () => {
  it('filters by text, status, domain, cadence and configuration and keeps the state in the URL', async () => {
    const { store } = await openSources();
    const rows = () => [...document.querySelectorAll('table[aria-label="Quellenzuordnungen"] tbody tr')].map((item) => item.textContent ?? '');
    expect(rows()).toHaveLength(2);
    await setValue(document.getElementById('sources-search') as HTMLInputElement, 'haustür');
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain('Haustür Kontakt');
    expect(location.hash).toContain('q=haust');
    await setValue(document.getElementById('sources-search') as HTMLInputElement, '');
    await setValue(document.getElementById('sources-status') as HTMLSelectElement, 'blocked');
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain('Haustür Kontakt');
    await setValue(document.getElementById('sources-status') as HTMLSelectElement, 'healthy');
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain('Wohnzimmer Temperatur');
    await setValue(document.getElementById('sources-status') as HTMLSelectElement, 'not_configured');
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain('Haustür Kontakt');
    await setValue(document.getElementById('sources-status') as HTMLSelectElement, 'all');
    await setValue(document.getElementById('sources-domain') as HTMLSelectElement, 'sensor');
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain('Wohnzimmer');
    await setValue(document.getElementById('sources-domain') as HTMLSelectElement, 'all');
    await setValue(document.getElementById('sources-cadence') as HTMLSelectElement, 'periodic');
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain('Wohnzimmer');
    await setValue(document.getElementById('sources-cadence') as HTMLSelectElement, 'unknown');
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain('Haustür');
    expect(location.hash).toContain('cadence=unknown');
    await setValue(document.getElementById('sources-type') as HTMLSelectElement, 'multisensor');
    expect(rows()).toHaveLength(0);
    await click(button('Filter zurücksetzen'));
    expect(rows()).toHaveLength(2);
    expect(store.sourceFilter.cadence).toBe('all');
  });

  it('shows the required columns, keeps long entity IDs inside their cell and opens the inspector on row click', async () => {
    await openSources();
    const headers = [...document.querySelectorAll('table[aria-label="Quellenzuordnungen"] th')].map((item) => item.textContent?.trim());
    for (const label of ['Name', 'Home-Assistant-Entity', 'Rolle', 'Gerät', 'Kadenz', 'Frische', 'Status', 'Konsumenten']) expect(headers).toContain(label);
    const longId = 'sensor.living_room_multisensor_temperature_measurement_channel_long_id';
    const cell = document.querySelector(`code[title="${longId}"]`) as HTMLElement;
    expect(cell.classList.contains('truncate')).toBe(true);
    expect(button(`Entity-ID ${longId} kopieren`)).toBeTruthy();
    const row = [...document.querySelectorAll('table[aria-label="Quellenzuordnungen"] tbody tr')].find((item) => item.textContent?.includes('Wohnzimmer Temperatur')) as HTMLTableRowElement;
    await click(row);
    const inspector = document.querySelector('[aria-label="Quellen-Inspector"]') as HTMLElement;
    expect(inspector.textContent).toContain('Wohnzimmer Temperatur');
    expect(inspector.textContent).toContain('Quelle überschreibt Gerätewert');
    expect(inspector.textContent).toContain('10 min');
    expect(location.hash).toContain('id=binding.living.temperature');
    expect(document.querySelector('table[aria-label="Quellenzuordnungen"]')).not.toBeNull();
  });
});
