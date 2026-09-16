<script lang="ts">
  import type { CoreContractsStore } from '../../lib/core-contracts/store.svelte';
  import type { Profile } from '../../lib/core-contracts/registry.svelte';
  import type { Density, MotionPreference, OpenBehavior, StartView, TextSize, TimeDisplay } from '../../lib/core-contracts/preferences.svelte';
  import { CONNECTION_LABELS } from '../../lib/core-contracts/labels';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';

  /**
   * Einstellungen: effective display and behaviour preferences (persisted in the
   * browser, applied to the whole panel) plus mostly read-only system facts.
   * Theme and font family are inherited from Home Assistant.
   */
  let { store }: { store: CoreContractsStore } = $props();
  let prefs = $derived(store.preferences);
  let registry = $derived(store.registry);
  let profileTarget = $state<Profile | null>(null);
  const startViews: { value: StartView; label: string }[] = [{ value: 'overview', label: 'Übersicht' }, { value: 'contracts', label: 'Verträge' }, { value: 'sources', label: 'Quellen' }, { value: 'devices', label: 'Geräte' }, { value: 'problems', label: 'Aktuelle Probleme' }, { value: 'changes', label: 'Änderungen' }, { value: 'last', label: 'Zuletzt geöffnete Ansicht' }];
</script>

<div class="settings">
  <section aria-labelledby="settings-display">
    <h2 id="settings-display">Darstellung</h2>
    <p class="quiet">Wirkt sofort auf alle Ansichten und bleibt in diesem Browser erhalten.</p>
    <label><span>Ansichtsdichte</span><select value={prefs.density} onchange={(event) => prefs.set('density', event.currentTarget.value as Density)}><option value="comfortable">Komfortabel</option><option value="compact">Kompakt</option></select></label>
    <label><span>Technische Namen<small>IDs und technische Bezeichner zusätzlich anzeigen</small></span><input type="checkbox" checked={prefs.technicalNames} onchange={(event) => prefs.set('technicalNames', event.currentTarget.checked)} /></label>
    <label><span>Zeitangaben</span><select value={prefs.timeDisplay} onchange={(event) => prefs.set('timeDisplay', event.currentTarget.value as TimeDisplay)}><option value="relative">Relativ („vor 5 Minuten“)</option><option value="exact">Exakt (Datum und Uhrzeit)</option><option value="both">Beides</option></select></label>
    <label><span>Textgröße</span><select value={prefs.textSize} onchange={(event) => prefs.set('textSize', event.currentTarget.value as TextSize)}><option value="system">Systemstandard</option><option value="large">Größer</option><option value="xlarge">Sehr groß</option></select></label>
    <label><span>Bewegung<small>Animationen und Übergänge</small></span><select value={prefs.motion} onchange={(event) => prefs.set('motion', event.currentTarget.value as MotionPreference)}><option value="system">Systemeinstellung befolgen</option><option value="reduce">Immer reduzieren</option></select></label>
    <p class="quiet">Farbschema und Schriftfamilie werden von Home Assistant geerbt.</p>
  </section>

  <section aria-labelledby="settings-behavior">
    <h2 id="settings-behavior">Verhalten</h2>
    <label><span>Startansicht</span><select value={prefs.startView} onchange={(event) => prefs.set('startView', event.currentTarget.value as StartView)}>{#each startViews as item (item.value)}<option value={item.value}>{item.label}</option>{/each}</select></label>
    <label><span>Datensatz öffnen<small>Zeilenklick in Listen</small></span><select value={prefs.openBehavior} onchange={(event) => prefs.set('openBehavior', event.currentTarget.value as OpenBehavior)}><option value="inspector">Im Inspector neben der Liste</option><option value="detail">Als vollständige Detailseite</option></select></label>
    <label><span>Profil<small>Konfigurationsprofil derselben Engine; Entwürfe bleiben profilbezogen</small></span><select value={registry.profile} disabled={registry.busy || registry.dirty || !!registry.importText} onchange={(event) => { const next = event.currentTarget.value as Profile; event.currentTarget.value = registry.profile; if (next !== registry.profile) profileTarget = next; }}><option value="benni">Benni</option><option value="eltern">Eltern</option></select></label>
    {#if registry.dirty || registry.importText}<p class="quiet">Profilwechsel erst nach Speichern oder Verwerfen des Entwurfs.</p>{/if}
  </section>

  <section aria-labelledby="settings-system" class="system">
    <h2 id="settings-system">System · schreibgeschützt</h2>
    <dl class="kv">
      <div><dt>Profil</dt><dd>{registry.profile === 'eltern' ? 'Eltern' : 'Benni'}</dd></div>
      <div><dt>Registry-Quelle</dt><dd>{registry.view?.registry.source ?? 'Nicht bereit'}{registry.view?.registry.used_last_known_good ? ' · Last Known Good aktiv' : ''}</dd></div>
      <div><dt>Datenbankstatus</dt><dd>{registry.view?.registry.health ?? 'Nicht verbunden'}{registry.view?.registry.reason ? ` · ${registry.view.registry.reason}` : ''}</dd></div>
      <div><dt>Schema-Version</dt><dd>{registry.view?.registry.revision?.payload.schema_version ?? '—'}</dd></div>
      <div><dt>Aktive Version</dt><dd>{registry.activeRevision ?? (store.revision || '—')}</dd></div>
      <div><dt>Entwurf</dt><dd>{registry.draft ? `${registry.draft.draft_id} (Basis ${registry.draft.base_revision})` : 'Keiner'}</dd></div>
      <div><dt>Verbindung</dt><dd>{CONNECTION_LABELS[store.connectionState] ?? store.connectionState}{store.lastUpdated ? ` · Stand ${store.when(store.lastUpdated)}` : ''}</dd></div>
      <div><dt>Berechtigung</dt><dd>{registry.admin ? 'Administrator: Entwürfe bearbeiten erlaubt' : 'Nur lesen'}</dd></div>
      <div><dt>Verfügbare Schemata</dt><dd>{(registry.view?.schemas ?? []).map((schema) => `${schema.schema_id} v${schema.version}`).join(', ') || '—'}</dd></div>
    </dl>
    <p class="quiet">PostgreSQL wird serverseitig konfiguriert. Zugangsdaten gehören in Home-Assistant-Secrets, niemals in Registry, Import oder Frontend.</p>
  </section>
</div>

{#if profileTarget}
  <ConfirmDialog title={`Profil auf „${profileTarget === 'eltern' ? 'Eltern' : 'Benni'}“ wechseln?`} message="Alle Ansichten zeigen danach die Konfiguration und Verträge dieses Profils. Ein leerer Entwurf wird verworfen." confirmLabel="Profil wechseln" busy={registry.busy} onConfirm={async () => { const target = profileTarget; profileTarget = null; if (target) await store.switchProfile(target); }} onCancel={() => (profileTarget = null)} />
{/if}

<style>
  .settings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
  section { display: grid; align-content: start; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
  section.system { grid-column: 1 / -1; }
  h2 { margin: 0; font-size: 1rem; }
  section > p { margin: 0; font-size: 0.76rem; }
  label { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 44px; font-size: 0.84rem; }
  label > span { display: grid; gap: 2px; }
  label small { color: var(--color-text-muted); font-size: 0.7rem; }
  select { min-width: 220px; }
  input[type="checkbox"] { width: 22px; height: 22px; accent-color: var(--color-info); }
  @media (max-width: 760px) { .settings { grid-template-columns: 1fr; } label { align-items: flex-start; flex-direction: column; } select { width: 100%; min-width: 0; } }
</style>
