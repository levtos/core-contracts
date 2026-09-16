// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import App from '../../app/App.svelte';
import { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
import { createFakeBackend, frontDoorPayload } from '../../lib/core-contracts/test-backend';

let component: ReturnType<typeof mount> | undefined;
let store: CoreContractsStore | undefined;
afterEach(async () => { store?.stop(); if (component) await unmount(component); component = undefined; store = undefined; history.replaceState(null, '', '#/'); document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks(); });

const settle = async () => { for (let i = 0; i < 4; i += 1) { await new Promise((resolve) => setTimeout(resolve, 0)); await tick(); } flushSync(); };
const text = () => document.body.textContent ?? '';
const button = (label: string, root: ParentNode = document) => [...root.querySelectorAll('button')].find((item) => (item.textContent ?? '').includes(label) || item.getAttribute('aria-label') === label) as HTMLButtonElement;
const click = async (element: HTMLElement | undefined) => { expect(element, 'element to click').toBeTruthy(); element!.click(); await settle(); };
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const setValue = async (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => { input.value = value; input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); await settle(); };
const table = (label: string) => document.querySelector(`table[aria-label="${label}"]`) as HTMLTableElement | null;
const rows = (label: string) => [...(table(label)?.querySelectorAll('tbody tr') ?? [])] as HTMLTableRowElement[];
const navigate = async (hash: string) => { location.hash = hash; await settle(); await settle(); };

async function open(hash: string, options: Parameters<typeof createFakeBackend>[0] = {}) {
  const backend = createFakeBackend(options);
  history.replaceState(null, '', hash);
  store = new CoreContractsStore();
  store.setHass(backend.hass);
  component = mount(App, { target: document.body, props: { store } });
  await settle();
  await vi.waitFor(() => { expect(store!.connectionState).toBe('connected'); expect(store!.registry.view).not.toBeNull(); });
  await settle();
  return { backend, store: store! };
}

describe('Listenmuster: Hero-Kennzahlen, Tabellen, Inspector und Stift', () => {
  it('renders static hero figures without inputs and a table for fusions, contracts and devices', async () => {
    await open('#/sources?tab=fusions');
    expect(document.querySelector('.hero-stats input, .hero-stats select, .hero-stats button')).toBeNull();
    expect(text()).toContain('Aktive Version');
    expect(table('Zusammenführungen')).not.toBeNull();
    expect(table('Quellenzuordnungen')).toBeNull();
    expect(rows('Zusammenführungen')).toHaveLength(2);
    expect(text()).toContain('Erste gesunde Quelle');
    await navigate('#/contracts');
    expect(table('Verträge')).not.toBeNull();
    expect(rows('Verträge')).toHaveLength(2);
    expect([...document.querySelectorAll('table[aria-label="Verträge"] th')].map((item) => item.textContent?.trim())).toEqual(expect.arrayContaining(['Name', 'Wert', 'Qualität', 'Frische', 'Unbekannt', 'Verbraucher']));
    await navigate('#/devices');
    expect(table('Geräte')).not.toBeNull();
    expect(rows('Geräte')).toHaveLength(1);
    expect(rows('Geräte')[0].textContent).toContain('Multisensor');
    expect(rows('Geräte')[0].textContent).toContain('Regelmäßig (periodisch)');
  });

  it('opens the inspector on row click and the dialog on the pencil for contracts, fusions and devices', async () => {
    const { store } = await open('#/contracts');
    await click(rows('Verträge')[0]);
    expect(document.querySelector('[aria-label="Vertrags-Inspector"]')).not.toBeNull();
    expect(table('Verträge')).not.toBeNull();
    await click(button('Vertrag opening.front_door bearbeiten'));
    expect(dialog()!.textContent).toContain('Vertrag bearbeiten: Haustür');
    expect(store.registry.dialog).toBe('contract');
    await click(button('Abbrechen', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    await navigate('#/sources?tab=fusions');
    await click(rows('Zusammenführungen')[0]);
    expect(document.querySelector('[aria-label="Zusammenführungs-Inspector"]')!.textContent).toContain('Eingänge in Reihenfolge');
    await click(button('Zusammenführung opening.front_door · opening_state bearbeiten'));
    expect(dialog()!.textContent).toContain('Zusammenführung bearbeiten');
    await click(button('Abbrechen', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    await navigate('#/devices');
    await click(rows('Geräte')[0]);
    expect(document.querySelector('[aria-label="Geräte-Inspector"]')!.textContent).toContain('Zugeordnete Quellen');
    await click(button('Gerät Multisensor bearbeiten'));
    expect(dialog()!.textContent).toContain('Gerät bearbeiten: Multisensor');
    expect(store.registry.dialog).toBe('device');
  });

  it('supports keyboard: Enter on a row opens the inspector, Tab is trapped inside a dialog and focus returns on close', async () => {
    await open('#/sources');
    const row = rows('Quellenzuordnungen')[0];
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(document.querySelector('[aria-label="Quellen-Inspector"]')).not.toBeNull();
    const pencil = button('Quelle Haustür Kontakt bearbeiten', row);
    pencil.focus();
    await click(pencil);
    const focusables = [...dialog()!.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')];
    focusables[focusables.length - 1].focus();
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusables[0]);
    await click(button('Abbrechen', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(pencil);
  });
});

describe('Quelle anlegen, deaktivieren und löschen', () => {
  it('creates a new source through the dialog and counts the real diff', async () => {
    const { backend, store } = await open('#/sources');
    expect(store.registry.changeCount).toBe(0);
    await click(button('Quelle hinzufügen'));
    expect(dialog()!.textContent).toContain('Neue Quelle anlegen');
    const inputs = [...dialog()!.querySelectorAll('input')];
    await setValue(inputs.find((item) => item.placeholder?.includes('Fensterkontakt')) as HTMLInputElement, 'Ersatzsensor');
    await setValue(inputs.find((item) => item.getAttribute('list') === 'binding-dialog-entities') as HTMLInputElement, 'sensor.spare');
    await setValue(inputs.find((item) => item.getAttribute('list') === 'binding-dialog-fields') as HTMLInputElement, 'humidity');
    await setValue(inputs.find((item) => item.getAttribute('list') === 'binding-dialog-capabilities') as HTMLInputElement, 'room_climate');
    expect(store.registry.changeCount).toBe(1);
    expect(backend.calls.some((item) => String(item.type).includes('binding/create'))).toBe(false);
    await click(button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(dialog()).toBeNull();
    expect(backend.calls.some((item) => String(item.type).includes('binding/create'))).toBe(true);
    expect(store.registry.changeCount).toBe(1);
    expect(rows('Quellenzuordnungen')).toHaveLength(3);
    expect(text()).toContain('1 Änderungen');
  });

  it('deactivates and deletes only after confirmation that names the effects', async () => {
    const { backend, store } = await open('#/sources');
    await click(rows('Quellenzuordnungen').find((row) => row.textContent?.includes('Haustür Kontakt')));
    await click(button('Deaktivieren', document.querySelector('[aria-label="Quellen-Inspector"]') as HTMLElement));
    expect(dialog()!.textContent).toContain('Auswirkungen');
    expect(dialog()!.textContent).toContain('opening.front_door');
    expect(dialog()!.textContent).toContain('door_policy');
    expect(backend.calls.some((item) => String(item.type).includes('set_enabled'))).toBe(false);
    await click(button('Abbrechen', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(backend.calls.some((item) => String(item.type).includes('set_enabled'))).toBe(false);
    await click(button('Deaktivieren', document.querySelector('[aria-label="Quellen-Inspector"]') as HTMLElement));
    await click(button('Deaktivieren', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(store.registry.draft?.payload.bindings.find((item) => item.binding_id === 'binding.front-door')?.enabled).toBe(false);
    expect(store.registry.changeCount).toBe(1);
    expect(rows('Quellenzuordnungen').find((row) => row.textContent?.includes('Haustür Kontakt'))!.textContent).toContain('Deaktiviert');
    await click(button('Löschen', document.querySelector('[aria-label="Quellen-Inspector"]') as HTMLElement));
    expect(dialog()!.textContent).toContain('Pflichtquelle');
    await click(button('Löschen', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(store.registry.draft?.payload.bindings.some((item) => item.binding_id === 'binding.front-door')).toBe(false);
    expect(rows('Quellenzuordnungen')).toHaveLength(1);
    expect(store.registry.changeCount).toBe(1);
    expect(backend.active.revision).toBe(1);
  });
});

describe('Zusammenführungen und Verträge', () => {
  it('creates a fusion for a new contract and edits its strategy without any activation', async () => {
    const { backend, store } = await open('#/sources?tab=fusions');
    await click(button('Zusammenführung hinzufügen'));
    const contractInput = dialog()!.querySelector('input[list="fusion-dialog-contracts"]') as HTMLInputElement;
    await setValue(contractInput, 'room.kitchen');
    const selects = [...dialog()!.querySelectorAll('select')];
    await setValue(selects[0], 'room_climate:1');
    await setValue(selects[1], 'temperature');
    await setValue(selects[2], 'latest');
    const checkbox = [...dialog()!.querySelectorAll('input[type="checkbox"]')].find((item) => item.parentElement?.textContent?.includes('Wohnzimmer Temperatur')) as HTMLInputElement;
    checkbox.click(); await settle();
    expect(dialog()!.textContent).toContain('Neuester Wert');
    await click(button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(dialog()).toBeNull();
    expect(backend.calls.some((item) => String(item.type).includes('contract_instance/create'))).toBe(true);
    expect(backend.calls.some((item) => String(item.type).includes('fusion/create'))).toBe(true);
    expect(backend.calls.some((item) => String(item.type).includes('draft/save'))).toBe(false);
    expect(rows('Zusammenführungen')).toHaveLength(3);
    expect(store.registry.fusions.find((item) => item.contract_id === 'room.kitchen')?.strategy).toBe('latest');
    const row = rows('Zusammenführungen').find((item) => item.textContent?.includes('room.kitchen'))!;
    await click(button('Zusammenführung room.kitchen · temperature bearbeiten', row));
    await setValue([...dialog()!.querySelectorAll('select')][2], 'first_healthy');
    await click(button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(store.registry.fusions.find((item) => item.contract_id === 'room.kitchen')?.strategy).toBe('first_healthy');
    expect(text()).not.toContain('binary_sensor.front_door_contact');
  });

  it('creates and edits a contract and offers an independent full detail route', async () => {
    const { store } = await open('#/contracts');
    await click(button('Vertrag hinzufügen'));
    await setValue(dialog()!.querySelector('input[data-autofocus]') as HTMLInputElement, 'Küche');
    await setValue(dialog()!.querySelector('select') as HTMLSelectElement, 'opening:1');
    await click(button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(store.registry.instances.some((item) => item.display_name === 'Küche')).toBe(true);
    expect(text()).toContain('Konfiguriert, aber noch nicht berechnet');
    await click(button('Vertrag opening.front_door bearbeiten'));
    await setValue(dialog()!.querySelector('input[data-autofocus]') as HTMLInputElement, 'Haustür (neu)');
    await click(button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(store.registry.instances.find((item) => item.contract_id === 'opening.front_door')?.display_name).toBe('Haustür (neu)');
    await navigate('#/contract?contract=opening.front_door');
    expect(store.activeView).toBe('contract');
    expect(document.querySelector('[aria-label="Vertrags-Inspector"]')).toBeNull();
    for (const label of ['Überblick', 'Felder', 'Abhängigkeiten', 'Verwendung', 'Technische Details', 'Warum?']) expect(text()).toContain(label);
    const tab = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((item) => item.textContent?.includes(label));
    await click(tab('Abhängigkeiten'));
    expect(text()).toContain('Haustür Kontakt');
    await click(tab('Verwendung'));
    expect(text()).toContain('door_policy');
  });

  it('explains a field decision with candidates, timestamps, cadence, liveness and a plain-language conclusion', async () => {
    await open('#/trace?contract=opening.front_door&field=opening_state');
    for (const label of ['Aktuelles Ergebnis', 'Entscheidung in einfacher Sprache', 'Kandidaten in Reihenfolge', 'Nicht gewählt', 'Gerätezeit', 'Home-Assistant-Zeit', 'Alter gegen Grenze', 'Kadenz', 'Lebenszeichen', 'Verwendeter Zeitstempel']) expect(text()).toContain(label);
    expect(text()).toContain('Legacy · kein Gerätebezug');
    expect(text()).toContain('Für diese Quelle ist ein Gerätezeitstempel erforderlich.');
    expect(text()).toContain('„unbekannt“ ist hier eine gültige neutrale Aussage');
    expect(document.querySelector('details')).not.toBeNull();
    expect(document.querySelector('.status-badge.danger')?.textContent).not.toContain('Unbekannt');
  });
});

describe('Aktuelle Probleme, Änderungen und Übersicht', () => {
  it('lists source, device and role problems with a direct action each', async () => {
    const payload = frontDoorPayload();
    payload.bindings.push({ binding_id: 'binding.gone', source_id: 'source.gone', entity_id: 'sensor.does_not_exist', field: 'humidity', capability: 'room_climate', profile_id: 'benni', required: true, freshness_ttl_seconds: 300, consumer_ids: [], fallback: { action: 'reject', default_value: null, reason: '' }, read_only: true, display_name: 'Verschwundener Sensor', device_id: 'device-living' });
    payload.fusions.push({ fusion_id: 'fusion.living.humidity', contract_id: 'room.living', field: 'humidity', input_binding_ids: ['binding.gone'], input_fusion_ids: [], strategy: 'first_healthy', consumer_ids: ['climate_policy'] });
    const { store } = await open('#/problems', { payload });
    expect(store.activeView).toBe('problems');
    for (const label of ['Vertragsfelder ohne verwendbare Pflichtquelle', 'Eingeschränkte oder blockierte Quellen', 'Geräte ohne Lebenszeichenquelle', 'Nicht mehr existierende Entity-Referenzen', 'Nicht gebundene Pflichtrollen', 'Quellen ohne Gerätebezug (Legacy)']) expect(text()).toContain(label);
    expect(text()).toContain('sensor.does_not_exist');
    expect(text()).toContain('wake_planner');
    expect(text()).toContain('Nicht gebunden');
    await click(button('Lebenszeichen festlegen'));
    expect(store.activeView).toBe('devices');
    expect(dialog()!.textContent).toContain('Gerät bearbeiten: Multisensor');
    await click(button('Abbrechen', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    await navigate('#/problems');
    await click(button('Gerät zuordnen'));
    expect(store.activeView).toBe('sources');
    expect(dialog()!.textContent).toContain('Quelle bearbeiten: Haustür Kontakt');
  });

  it('keeps Änderungen limited to diff, validation, import/export, history and rollback', async () => {
    const { backend, store } = await open('#/changes');
    expect(table('Quellenzuordnungen')).toBeNull();
    expect(text()).not.toContain('Quelle hinzufügen');
    expect(text()).not.toContain('Zusammenführung hinzufügen');
    expect(text()).not.toContain('Vertrag hinzufügen');
    for (const label of ['Unterschiede zur aktiven Version', 'Import / Export', 'Versionshistorie', 'Rollback']) expect(text()).toContain(label);
    expect(table('Entwurfs-Diff')).toBeNull();
    store.registry.select(store.registry.bindings[0]); await settle();
    await setValue(dialog()!.querySelector('input[data-autofocus]') as HTMLInputElement, 'Umbenannt');
    await click(button('Speichern', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(rows('Entwurfs-Diff')).toHaveLength(1);
    expect(text()).toContain('Anzeigename');
    expect(text()).toContain('Betroffene Verträge');
    expect(text()).toContain('opening.front_door');
    await click(button('Speichern und aktivieren', document.querySelector('.changes') as HTMLElement));
    await click(button('Speichern und aktivieren', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(backend.active.revision).toBe(2);
    await settle();
    expect(rows('Versionshistorie')).toHaveLength(2);
    const rollback = [...document.querySelectorAll<HTMLButtonElement>('table[aria-label="Versionshistorie"] button')].find((item) => !item.disabled);
    await click(rollback);
    expect(dialog()!.textContent).toContain('wiederherstellen');
    await click(button('Rollback aktivieren', dialog()!.querySelector('.dialog-actions') as HTMLElement));
    expect(backend.active.revision).toBe(3);
    expect(backend.active.payload.bindings[0].display_name).toBe('Haustür Kontakt');
  });

  it('separates unknown, degraded, blocked and unconfigured in the overview and explains overlaps', async () => {
    const { store } = await open('#/overview');
    expect(text()).toContain('Wert unbekannt');
    expect(text()).toContain('neutrale Information, kein Fehler');
    expect(text()).toContain('Quellen mit Gerät');
    expect(text()).toContain('erscheint sowohl unter „Wert unbekannt“ als auch unter „Eingeschränkt/Blockiert“');
    expect(store.dataState).toBe('blocked');
    await click(button('Alle Probleme'));
    expect(store.activeView).toBe('problems');
  });
});

describe('Einstellungen, Zustände und Verbindung', () => {
  it('applies settings globally and keeps them after navigation and reload', async () => {
    const { store } = await open('#/settings');
    const selects = [...document.querySelectorAll('.settings select')];
    await setValue(selects[0] as HTMLSelectElement, 'compact');
    await setValue(selects[3] as HTMLSelectElement, 'reduce');
    await setValue(selects[4] as HTMLSelectElement, 'sources');
    await setValue(selects[5] as HTMLSelectElement, 'detail');
    (document.querySelector('.settings input[type="checkbox"]') as HTMLInputElement).click(); await settle();
    expect(document.querySelector('.app-shell')!.className).toContain('density-compact');
    expect(document.querySelector('.app-shell')!.className).toContain('motion-reduce');
    await navigate('#/sources');
    expect(text()).toContain('binding.front-door');
    expect(document.querySelector('.app-shell')!.className).toContain('density-compact');
    store.stop(); await unmount(component!); component = undefined; document.body.innerHTML = '';
    const reloaded = new CoreContractsStore();
    expect(reloaded.preferences.snapshot).toMatchObject({ density: 'compact', motion: 'reduce', startView: 'sources', openBehavior: 'detail', technicalNames: true });
    expect(reloaded.preferences.initialView).toBe('sources');
  });

  it('shows loading, offline and reconnect states separately from data quality', async () => {
    const backend = createFakeBackend();
    store = new CoreContractsStore();
    history.replaceState(null, '', '#/sources');
    component = mount(App, { target: document.body, props: { store } });
    await settle();
    expect(text()).toContain('Keine Verbindung');
    store.setHass(backend.hass);
    await vi.waitFor(() => expect(store!.connectionState).toBe('connected'));
    await settle();
    expect(text()).toContain('Verbunden');
    expect(text()).toContain('Mindestens ein Vertrag blockiert');
    const send = backend.hass.connection!.sendMessagePromise;
    backend.hass.connection!.sendMessagePromise = async () => { throw new Error('socket closed'); };
    await store.refresh(); await settle();
    expect(store.connectionState).toBe('offline');
    expect(text()).toContain('Verbindung unterbrochen');
    expect(rows('Quellenzuordnungen')).toHaveLength(2);
    backend.hass.connection!.sendMessagePromise = send;
    await store.refresh(); await settle();
    expect(store.connectionState).toBe('connected');
  });

  it('renders unknown as neutral, degraded as warning, blocked as danger and unconfigured as info', async () => {
    await open('#/sources');
    const badge = (status: string) => document.querySelector(`.status-badge[data-status="${status}"]`);
    expect(badge('blocked')?.className).toContain('danger');
    expect(badge('unknown')?.className).toContain('neutral');
    expect(badge('healthy')?.className).toContain('healthy');
    await click(button('Zusammenführungen'));
    expect(badge('blocked')?.className).toContain('danger');
  });

  it('offers every graph mode with device and consumer focus and marks the used path', async () => {
    const { store } = await open('#/graph');
    for (const label of ['Nur aktuelle Entscheidung', 'Alle konfigurierten Pfade', 'Nur beeinträchtigte', 'Upstream', 'Downstream']) expect(text()).toContain(label);
    const focus = document.querySelector('select') as HTMLSelectElement;
    expect([...focus.options].some((item) => item.value === 'device:device-living')).toBe(true);
    expect([...focus.options].some((item) => item.value === 'consumer:door_policy')).toBe(true);
    await setValue(focus, 'device:device-living');
    await setValue([...document.querySelectorAll('select')][1] as HTMLSelectElement, 'all');
    expect(store.graphMode).toBe('all');
    expect(location.hash).toContain('focus=device');
    expect(document.querySelector('article.focus')!.textContent).toContain('Multisensor');
    expect([...document.querySelectorAll('article.used')].some((item) => item.textContent?.includes('Wohnzimmer Temperatur'))).toBe(true);
    expect(text()).toContain('Unbekannt ist ein neutraler Wert');
    await setValue(focus, 'consumer:door_policy');
    await setValue([...document.querySelectorAll('select')][1] as HTMLSelectElement, 'impaired');
    expect(text()).toContain('opening.front_door');
  });
});
