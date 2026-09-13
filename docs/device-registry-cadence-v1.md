# Device Registry Cadence v1

> **Status: unvollständiger Entwurf – nur Stufe 1.** Die Freshness-Auswertung,
> Liveness-Plausibilisierung, Diagnostik und Laufzeitsemantik folgen erst in
> Stufe 2. Dieses Dokument beschreibt deshalb noch kein vollständiges
> Freshness-Verhalten.

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

## Migration und Aktivierung

Registry-v1-Revisionen bleiben lesbar und behalten ihre kanonische
Serialisierung und Prüfsumme. Bestehende Bindings ohne `device_id` und ohne
Overrides bleiben unverändert. Erst eine ausdrückliche Device- oder
Device-Binding-Bearbeitung hebt den betroffenen Entwurf auf Schema v2. Das
PostgreSQL-Tabellenschema ändert sich nicht, weil der Payload als JSONB
gespeichert wird.

Diese Stufe aktiviert keine Registry-Revision und verändert keine
Freshness-Auswertung. Weitere Produktdokumentation und README-Anpassungen sind
absichtlich bis Stufe 2 zurückgestellt.
