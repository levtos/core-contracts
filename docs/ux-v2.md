# Core Contracts UX V2 – Darstellungsschicht

Nachfolger von [UX V1](ux-v1.md). V2 ist ein Umbau der Darstellungsschicht
und der Bedienflüsse; Informationsarchitektur, Backend, Datenmodell und
WebSocket-API sind unverändert. Alle Aktionen laufen ausschließlich über die
bestehenden Kommandos `benni_core_contracts/list_contracts`, `get_contract`,
`get_diagnostics`, `get_graph`, `get_health`, `registry/view` und die
Registry-Draft-Familie (`draft/*`, `binding/*`, `fusion/*`,
`contract_instance/*`, `device/suggest`, `device/*`, `export`, `import`,
`migration_candidates`, `rollback`).

## Bereiche

| Bereich | Inhalt |
|---|---|
| Übersicht | Systemzustand, getrennte Konfigurations- und Qualitätskennzahlen (Verträge, Quellen, Geräte, Quellen mit Gerät; Wert unbekannt, eingeschränkt, blockiert), Einstieg in Probleme |
| Verträge | Tabelle links, Inspector rechts, Stift → Vertragsdialog, eigenständige Detailroute `#/contract` mit Überblick, Felder, Abhängigkeiten, Verwendung, technische Details; „Warum?“ je Feld → `#/trace` |
| Quellen | Unteransichten Quellenzuordnungen und Zusammenführungen, je mit Kennzahlen, Tabelle, Suche/Sortierung/Filter, Inspector und Stift-Dialog |
| Geräte | Bestätigte Geräte mit Kadenz, Intervall, Lebenszeichen, zugeordneten Quellen; Stift → Gerätedialog |
| Abhängigkeiten | Fokussierter Graph (Gerät, Quelle, Zusammenführung, Vertragsfeld, Vertrag, Verbraucher) mit den Modi aktuelle Entscheidung, alle Pfade, nur beeinträchtigte, Upstream, Downstream |
| Aktuelle Probleme | Laufende Fundliste mit Status, Grund, betroffener Entität und direkter Aktion (ersetzt „Einrichtung prüfen“; alte Route `#/setup` leitet um) |
| Änderungen | Entwurfsstatus, echter Diff, Auswirkungen, Prüfen, Speichern und aktivieren, Import/Export, Versionshistorie, Rollback |
| Einstellungen | Ansichtsdichte, technische Namen, Zeitangaben, Textgröße, Bewegung, Startansicht, Datensatzöffnung, Profil; schreibgeschützte Systeminformationen |

## Bedienflüsse

Alle Listen: Kennzahlen oben (statisch), Tabelle, Zeilenklick → Inspector,
Stift → vollständiger Dialog mit **Speichern** und **Abbrechen**. Speichern
schreibt in den serverseitigen Entwurf, niemals in die aktive Version.
Abbrechen verwirft nur die Eingaben des Dialogs. Deaktivieren und Löschen
nennen Auswirkungen (Verträge, Verbraucher, Pflichtquelle) und verlangen
Bestätigung. Such- und Filterzustand liegt im URL-Query (`q`, `status`,
`domain`, `type`, `cadence`, `sort`, `dir`, `tab`, `id`, `focus`, `mode`).

### Versionsleiste

In jeder Ansicht sichtbar: aktive Version, Entwurf mit echter Diff-Anzahl,
Speicherstatus (offene Formulareingaben / im Entwurf gespeichert), Prüfstatus,
zuletzt aktivierte Version sowie die Aktionen **Prüfen**, **Speichern und
aktivieren** und **Entwurf verwerfen**. Verbindung (WebSocket) und
Datenqualität sind zwei getrennte Anzeigen; „Verbunden“ ist keine Ampel.

### Zustände des Entwurfs

| Zustand | Bedeutung |
|---|---|
| Aktive Version | Vom Backend aktivierte Revision |
| Offene Formulareingaben | Dialog geöffnet, Eingaben noch nicht gespeichert; kein API-Write |
| Geänderter Entwurf | Dialog gespeichert; Änderungen liegen im serverseitigen Entwurf (`draft_id`, Basisrevision) |
| Geprüfter Entwurf | `draft/validate` erfolgreich oder mit Fehlern |
| Aktivierter Entwurf | `draft/save` hat geprüft, gespeichert und aktiviert |

Die bestehende API kennt kein „Entwurf speichern ohne Aktivieren“ als
eigenen Schritt: Dialog-Speichern legt die Änderung im Entwurf ab,
`draft/save` speichert und aktiviert atomar. Die Oberfläche benennt das als
„Speichern“ (Dialog) und „Speichern und aktivieren“ (Entwurf).

### Externe Änderungen während ein Dialog offen ist

Eingehende Aktualisierungen ändern Tabellen und Kennzahlen, nie den
Formularinhalt. Wird der gerade bearbeitete Eintrag in der aktiven Version
geändert, erscheint im Dialog ein Hinweis; Speichern ist gesperrt, bis der
Nutzer entscheidet: **Meine Eingaben behalten** (ohne serverseitigen Entwurf
wird die neue aktive Version zur Basis; nur dieser Eintrag erhält die
eigenen Werte), **Aktuelle Daten laden** oder **Abbrechen**. Ein bereits
angelegter serverseitiger Entwurf kann nicht umgebettet werden; das Backend
weist ihn beim Speichern mit `revision_conflict` ab, was angezeigt wird. Es
gibt keine stille Feldzusammenführung.

## Abnahmepfad: Gerätebezug und Kadenz für bestehende Quellen

1. Quelle ohne Gerät in der Tabelle finden (Status, Filter „nicht
   eingerichtet“, Problemliste „Quellen ohne Gerätebezug“).
2. Stift → Dialog „Quelle bearbeiten“.
3. „Vorschlag … prüfen“ ruft `device/suggest`; Vorschlag zeigt Gerät und
   Herkunft (Entity-Registry-Verknüpfung, Geräte-Label).
4. Meldeverhalten, Lebenszeichenquelle und Intervall bestätigen; alternativ
   ein bereits bestätigtes Gerät wählen.
5. „Vorschlag ausdrücklich übernehmen“ stagt die Gerätewerte lokal.
6. „Speichern“ schreibt `device/create|update` und `binding/update` in den
   Entwurf.
7. „Prüfen“ → `draft/validate`; „Speichern und aktivieren“ → `draft/save`.

Der Frontend-Test `SourcesFlow.test.ts` fährt diesen Pfad gegen ein
API-Double der bestehenden Kommandos; das Double simuliert die Backend-Regel,
dass ereignisbasierte Quellen ohne bekannte Kadenz blockiert bleiben, damit
der vorher blockierte Vertrag nach der Aktivierung gesund wird.

## Bekannte Grenzen (keine API-Erweiterung)

- Trace: Kadenz, Lebenszeichen und Alter/Grenze liegen als
  `freshness_assessment` je Feld bzw. je Signal vor; für nicht gewählte
  Kandidaten ohne Signal wird die konfigurierte Kadenz/Grenze angezeigt.
- Verworfene Kandidaten werden über `signals[].quality.reasons` erklärt;
  liegt für eine Quelle noch kein Signal vor, meldet der Trace „noch kein
  Signal empfangen“.
- Typkonflikte und Zyklen liefert das Backend als Validierungsmeldung
  (`validation_error` mit Text) bzw. Consumer-Status (`schema_mismatch`,
  `version_incompatible`); die Problemliste klassifiziert daraus.
- Gerätenamen und Labels stammen aus `hass.devices` des HA-Frontends; ohne
  diese Registry wird die Geräte-ID angezeigt.
- Prüfung und Auswirkungen: `draft/validate` liefert keine Liste betroffener
  Verträge; die Oberfläche leitet sie aus Diff und Fusionsgraph ab.

## Verifikation

```text
cd frontend && npm ci && npm run check && npm test && npm run build
cd .. && python -m pytest && python scripts/validate_repository.py
```
