# v0.2.4 — Core Contracts UX V2 (Darstellungsschicht)

Umbau der Darstellungsschicht und der Bedienflüsse des HA-Panels. Backend,
Datenmodell und WebSocket-API sind unverändert; die Oberfläche verwendet
ausschließlich die vorhandenen Lese- und Registry-Draft-Kommandos. Die
Release-Metadaten (Manifest, `RELEASE_VERSION`, pyproject, Frontend-Paket)
werden auf 0.2.4 vereinheitlicht; v0.2.3 trug ein abweichendes
`RELEASE_VERSION`.

## Oberfläche

- Bereiche: Übersicht, Verträge, Quellen (Quellenzuordnungen und
  Zusammenführungen), Geräte, Abhängigkeiten, Aktuelle Probleme (ersetzt
  „Einrichtung prüfen“), Änderungen, Einstellungen.
- Einheitliches Listenmuster: statische Kennzahlen, Tabelle, Zeilenklick →
  Inspector, Stift → vollständiger Dialog mit Speichern und Abbrechen.
  Suche, Sortierung und wirksame Filter im URL-Query.
- Bestehende Quelle ohne Gerät: Gerätevorschlag aus `device/suggest` mit
  Herkunft, ausdrückliche Bestätigung, alternatives Gerät, Kadenz,
  Meldeintervall und Lebenszeichenquelle; Speichern in den Entwurf, Prüfen,
  Speichern und aktivieren.
- Versionsleiste auf allen Ansichten: aktive Version, echte Diff-Anzahl,
  Speicher- und Prüfstatus, Aktionen; Verbindung und Datenqualität getrennt.
- Kein Autosave. Externe Änderung des bearbeiteten Eintrags während eines
  offenen Dialogs wird gemeldet und verlangt eine Entscheidung; keine stille
  Zusammenführung.
- Aktuelle Probleme mit Status, Grund, Entität und direkter Aktion je Fund.
- Änderungen enthält nur Entwurfsstatus, Diff mit Auswirkungen, Prüfung,
  Speichern und aktivieren, Import/Export, Historie und Rollback.
- Trace mit Kandidaten, Verwerfungsgründen, Zeitstempeln, Alter gegen
  Grenze, Kadenz samt Herkunft, Lebenszeichen und Erklärung in einfacher
  Sprache.
- Einstellungen wirken global und bleiben erhalten; Statuszustände
  unknown/degraded/blocked/nicht eingerichtet getrennt; Tastatur, Fokus,
  reduzierte Bewegung, Lade-/Offline-/Reconnect-Zustände.

Details: [docs/ux-v2.md](ux-v2.md). Live-Installation, Reload und
Live-Verifikation bleiben Bennis Gate.
