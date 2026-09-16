import type { SourceCadence } from './types';

/** Plain-language labels. Technical names stay available as secondary text. */

export const STRATEGY_LABELS: Record<string, string> = {
  first_healthy: 'Erste gesunde Quelle',
  latest: 'Neuester Wert',
  any_true: 'Eine Quelle genügt (ODER)',
  all_true: 'Alle Quellen nötig (UND)',
  opening_contacts: 'Öffnungskontakte zusammenfassen',
  opening_is_open: 'Offen, sobald ein Kontakt offen ist',
  opening_available: 'Verfügbar, sobald eine Quelle verfügbar ist',
  opening_source_count: 'Anzahl verfügbarer Quellen',
  none: 'Nicht konfiguriert',
};

export const STRATEGY_HELP: Record<string, string> = {
  first_healthy: 'Die Quellen werden in der festgelegten Reihenfolge geprüft. Die erste gesunde und frische Quelle liefert den Wert.',
  latest: 'Unter allen verwendbaren Quellen gewinnt die mit dem jüngsten Zeitstempel.',
  any_true: 'Das Ergebnis ist wahr, sobald mindestens eine verwendbare Quelle wahr meldet.',
  all_true: 'Das Ergebnis ist nur wahr, wenn alle verwendbaren Quellen wahr melden.',
  opening_contacts: 'Alle Kontakte einer Öffnung werden zu einem Öffnungszustand zusammengefasst.',
  opening_is_open: 'Die Öffnung gilt als offen, sobald ein Kontakt offen meldet.',
  opening_available: 'Die Öffnung gilt als verfügbar, sobald eine Quelle verfügbar ist.',
  opening_source_count: 'Zählt die verfügbaren Quellen dieser Öffnung.',
  none: 'Für dieses Feld ist keine Zusammenführung konfiguriert.',
};

export const STRATEGIES = Object.keys(STRATEGY_LABELS).filter((key) => key !== 'none');

export function labelForStrategy(strategy: string): string {
  return STRATEGY_LABELS[strategy] ?? strategy;
}

export const CADENCE_LABELS: Record<SourceCadence, string> = {
  periodic: 'Regelmäßig (periodisch)',
  event_based: 'Nur bei Ereignis',
  unknown: 'Unbekannt',
};

export function labelForCadence(cadence: SourceCadence | string | null | undefined): string {
  if (!cadence) return 'Nicht festgelegt';
  return CADENCE_LABELS[cadence as SourceCadence] ?? String(cadence);
}

export const CADENCE_SOURCE_LABELS: Record<string, string> = {
  binding_override: 'Quelle überschreibt Gerätewert',
  device: 'Aus dem Gerätebezug',
  legacy_unknown: 'Legacy · kein Gerätebezug',
};

export function labelForCadenceSource(source: string | null | undefined): string {
  if (!source) return 'Nicht festgelegt';
  return CADENCE_SOURCE_LABELS[source] ?? source;
}

export const HEALTH_LABELS: Record<string, string> = {
  healthy: 'Gesund',
  degraded: 'Eingeschränkt',
  blocked: 'Blockiert',
  unknown: 'Unbekannt',
};

export const FRESHNESS_LABELS: Record<string, string> = {
  fresh: 'Frisch',
  suspect: 'Verdächtig',
  stale: 'Veraltet',
  unknown: 'Unbekannt',
  restored: 'Wiederhergestellt',
};

export const LIVENESS_LABELS: Record<string, string> = {
  not_applicable: 'Nicht relevant',
  alive: 'Lebendig',
  overdue: 'Überfällig',
  unknown: 'Unbekannt',
};

export const CONFIG_STATE_LABELS = {
  configured: 'Eingerichtet',
  disabled: 'Deaktiviert',
  incomplete: 'Nicht eingerichtet',
  no_device: 'Ohne Gerätebezug',
} as const;

export type ConfigState = keyof typeof CONFIG_STATE_LABELS;

export const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  healthy: 'Erfüllt',
  degraded: 'Eingeschränkt',
  blocked: 'Blockiert',
  unknown: 'Unbekannt',
  missing: 'Nicht gebunden',
  field_missing: 'Feld fehlt',
  schema_mismatch: 'Typkonflikt (Schema)',
  version_incompatible: 'Typkonflikt (Version)',
  binding_ambiguous: 'Mehrdeutige Zuordnung',
  runtime_not_ready: 'Laufzeit noch nicht bereit',
  consumer_not_registered: 'Verbraucher nicht registriert',
};

export const FALLBACK_LABELS: Record<string, string> = {
  none: 'Kein Fallback',
  hold_last: 'Letzten Wert halten',
  safe_default: 'Sicherer Standardwert',
  reject: 'Ablehnen',
};

export const REASON_LABELS: Record<string, string> = {
  freshness_ttl_exceeded: 'Der letzte Wert ist älter als die erlaubte Frischegrenze.',
  freshness_timestamp_unknown: 'Es liegt kein verwertbarer Zeitstempel vor.',
  freshness_timestamp_in_future: 'Der Zeitstempel liegt in der Zukunft und ist nicht plausibel.',
  source_unavailable: 'Die Home-Assistant-Entity ist nicht verfügbar.',
  source_stale: 'Die Quelle meldet veraltet.',
  source_restored: 'Der Wert stammt aus einer Wiederherstellung, nicht aus einer frischen Messung.',
  source_conflict: 'Mehrere Quellen widersprechen sich.',
  conflicting_fresh_sources: 'Mehrere frische Quellen liefern unterschiedliche Werte.',
  source_liveness_overdue: 'Das Gerät hat sich länger als erwartet nicht gemeldet.',
  source_liveness_unknown: 'Das Lebenszeichen des Geräts ist unbekannt.',
  liveness_entity_not_configured: 'Für dieses Gerät ist keine Lebenszeichenquelle festgelegt.',
  liveness_entity_unavailable: 'Die Lebenszeichenquelle ist nicht verfügbar.',
  liveness_entity_unknown: 'Die Lebenszeichenquelle ist unbekannt.',
  liveness_interval_exceeded: 'Das erwartete Meldeintervall ist überschritten.',
  liveness_interval_unknown: 'Es ist kein erwartetes Meldeintervall festgelegt.',
  liveness_timestamp_implausibly_old: 'Der Lebenszeichen-Zeitstempel ist unplausibel alt.',
  liveness_timestamp_in_future: 'Der Lebenszeichen-Zeitstempel liegt in der Zukunft.',
  liveness_timestamp_invalid: 'Der Lebenszeichen-Zeitstempel ist ungültig.',
  device_timestamp_required: 'Für diese Quelle ist ein Gerätezeitstempel erforderlich.',
  required_value_missing: 'Eine Pflichtquelle liefert keinen verwendbaren Wert.',
  optional_value_missing: 'Eine optionale Quelle liefert keinen Wert.',
  opening_source_missing: 'Für die Öffnung fehlt mindestens eine Quelle.',
  unknown_all_true_source: 'Eine Quelle der UND-Verknüpfung ist unbekannt.',
  unknown_any_true_source: 'Eine Quelle der ODER-Verknüpfung ist unbekannt.',
  hold_last_active: 'Der letzte bekannte Wert wird gehalten.',
  fallback_active: 'Ein Fallback-Wert ist aktiv.',
  no_fresh_valid_source: 'Keine Quelle ist gleichzeitig frisch und gültig.',
};

export function labelForReason(code: string, fallback?: string | null): string {
  return REASON_LABELS[code] ?? fallback ?? code;
}

export function entityDomain(entityId: string | null | undefined): string {
  if (!entityId || !entityId.includes('.')) return '';
  return entityId.split('.', 1)[0];
}

export const CONNECTION_LABELS: Record<string, string> = {
  loading: 'Verbindung wird aufgebaut',
  connected: 'Verbunden',
  reconnecting: 'Verbindung wird erneuert',
  offline: 'Verbindung unterbrochen',
  error: 'Verbindungsfehler',
  unavailable: 'Keine Verbindung',
};

export const DATA_STATE_LABELS: Record<string, string> = {
  loading: 'Daten werden geladen',
  ready: 'Alle Verträge gesund',
  empty: 'Keine Verträge',
  stale: 'Daten möglicherweise veraltet',
  degraded: 'Mindestens ein Vertrag eingeschränkt',
  blocked: 'Mindestens ein Vertrag blockiert',
};
