# Device Registry Cadence v1

> **Status: Stufe 1 und Stufe 2 implementiert.** Die Registry-Revision wird
> durch diese Änderung nicht aktiviert; vorhandene Bindings bleiben bis zu
> einer ausdrücklichen Registry-Änderung unverändert.

## Datenmodell

Registry-Schema v2 ergänzt `devices`. Ein Device speichert die bestätigte
HA-`device_id`, `source_cadence` (`periodic`, `event_based`, `unknown`), ein
optionales `expected_interval_s`, eine optionale `liveness_entity` sowie die
Herkunft der bestätigten Kadenz (`manual` oder `label` mit `label_id`).

Bindings können die `device_id` referenzieren. `device_overrides` kann
`source_cadence`, `expected_interval_s` und `liveness_entity` pro Binding
überschreiben. Fehlende Override-Schlüssel bedeuten Vererbung; `null` löscht
bei den beiden optionalen Werten ausdrücklich den geerbten Wert.

## Vorschläge und Bestätigung

Die Entity-zu-Device-Verknüpfung wird aus der HA Entity Registry gelesen. Die
Kadenz wird nie daraus oder aus Entity-Namen abgeleitet. Geräte-Labels liefern
nur einen sichtbaren, überschreibbaren Vorschlag:

1. `contact_sensor` → `event_based`
2. `vibration_sensor` → `event_based`
3. `remote` → `event_based`
4. `smoke_detector` → `event_based`
5. `climate_sensor` → `periodic`
6. `light_sensor` → `periodic`
7. `energy_meter` → `periodic`
8. `plug` → `periodic`
9. `light_device` → `periodic`

`zigbee` ist ausschließlich ein Transporthinweis. Die Reihenfolge macht die
Herkunft bei mehreren gleichgerichteten Labels deterministisch. Treffen
`event_based` und `periodic` zusammen, wird **nichts vorbelegt**: beide
Möglichkeiten und ihre Label-Herkunft werden angezeigt, der Konflikt wird
markiert und eine ausdrückliche Auswahl ist erforderlich.

Als Liveness-Kandidaten werden ausschließlich aktivierte Geschwister-Entities
desselben HA-Geräts mit `device_class: timestamp` angeboten. Genau ein Kandidat
kann vorgeschlagen werden; bei mehreren Kandidaten bleibt die Auswahl leer und
muss ausdrücklich erfolgen. Vorschlagsabfragen verändern keinen Entwurf.

## Laufzeitauflösung und Defaults

Die Laufzeit löst Kadenz, Intervall und Liveness-Entity in dieser Reihenfolge
auf: Binding-Override, bestätigtes Device, Legacy/`unknown`. Die vorläufigen,
änderbaren Defaults sind 172800 Sekunden für `event_based` und 3600 Sekunden
für `periodic`; die UX kennzeichnet sie als vorläufig.

## Freshness- und Liveness-Auswertung

`periodic` und Legacy/`unknown` vergleichen wie bisher das Alter des effektiven
Wert-Zeitstempels mit `freshness_ttl_seconds`. Für `event_based` gilt keine
Altersgrenze auf den Wert. Stattdessen entscheidet eine konfigurierte
Liveness-Entity, ob das Gerät innerhalb von `expected_interval_s` kommuniziert
hat.

Die Liveness-Auswertung kennt vier Zustände:

- `alive`: plausibler Liveness-Zeitstempel innerhalb des Intervalls; der alte
  Ereigniswert ist verwendbar.
- `overdue`: plausibler Zeitstempel ist älter als das Intervall, aber höchstens
  zehn Intervalle alt; der Wert ist `stale`.
- `unknown`: keine Entity oder kein Intervall, `unknown`/`unavailable`, ein
  Zeitstempel in der Zukunft oder ein mehr als zehn Intervalle alter
  Zeitstempel; dies ist weder frisch noch bewiesen veraltet.
- `not_applicable`: keine eventbasierte Auswertung.

Der dritte Fall wird als Zusatzfeld `liveness_status=unknown` in einer
strukturierten `FreshnessAssessment` dargestellt. Das bestehende
`FreshnessStatus`-Enum bleibt unverändert. Die strukturierte Bewertung ist aus
der Dataclass-Gleichheit ausgeschlossen, damit fortschreitende Alter und
Diagnosedetails keine `QUALITY_CHANGED`-Ereignisse erzeugen.

Restore, Retained, unerlaubte Zeitstempelherkunft und fehlender
Zeitstempelnachweis werden vor der Liveness-Auswertung geprüft. Eine aktuelle
Liveness-Meldung kann diese harten Gates nicht in `fresh` umwandeln. Ein
`snapshot.stale`-Override gilt nur für `periodic` und Legacy/`unknown`, nicht
für `event_based`.

Auswahl, veröffentlichte Feldqualität, Fallback-Diagnose, Owner-Gate,
Shadow-Verifikation und Live-Evidence verwenden dieselbe aufgelöste Bewertung.

## Diagnose

Die strukturierte Bewertung weist Kadenz und Herkunft, Wert-Zeitstempel samt
Alter und Herkunft, Liveness-Konfiguration, -Status, -Zeitstempel und Alter,
Plausibilisierungsgrund sowie die Anzahl der Bindings mit gleicher Kombination
aus Kadenz und Intervall aus. Die Anzahl ist reine Anzeige; Vorlagen oder
Gruppierung entstehen daraus nicht.

## Migration und Aktivierung

Registry-v1-Revisionen bleiben lesbar und behalten ihre kanonische
Serialisierung und Prüfsumme. Bestehende Bindings ohne `device_id` und ohne
Overrides bleiben unverändert. Erst eine ausdrückliche Device- oder
Device-Binding-Bearbeitung hebt den betroffenen Entwurf auf Schema v2. Das
PostgreSQL-Tabellenschema ändert sich nicht, weil der Payload als JSONB
gespeichert wird.

Diese Änderung aktiviert keine Registry-Revision und stellt keinen Consumer um.
