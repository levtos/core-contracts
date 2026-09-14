# v0.2.2 — Device Cadence und getrennte Liveness

Issue #36 ergänzt ein bestätigungspflichtiges HA-Gerätemodell und eine
kadenzabhängige Freshness-Auswertung. Die Änderung aktiviert keine
Registry-Revision, stellt keinen Consumer um und führt keine HA-Live-Änderung
aus.

## Gerätemodell und Vorschläge

- Registry-Schema v2 kennt Devices mit `source_cadence`, optionalem
  `expected_interval_s`, optionaler Timestamp-`liveness_entity` und
  nachvollziehbarer Kadenzherkunft.
- Bindings können die Device-Werte gezielt überschreiben; die Auflösung lautet
  Binding-Override → Device → Legacy/`unknown`.
- HA-Geräte-Labels liefern nur sichtbare Vorschläge. Widersprüchliche Kadenz-
  Labels und mehrere Liveness-Kandidaten erzwingen eine Auswahl.
- Die vorläufigen, änderbaren Defaults sind 48 Stunden für `event_based` und
  eine Stunde für `periodic`.

## Freshness

- `periodic` und Legacy/`unknown` behalten die bestehende TTL-Regel.
- `event_based` bewertet den letzten Ereigniswert über getrennte
  Geräte-Liveness. Ein plausibler aktueller Timestamp ergibt `alive`, ein
  plausibler überfälliger Timestamp `overdue`.
- Fehlende, `unknown`/`unavailable`, zukünftige oder mehr als zehn Intervalle
  alte Liveness-Evidenz ergibt `liveness_status=unknown`; sie wird weder als
  frisch noch als bewiesen tot behandelt.
- Restore, Retained, unerlaubte Herkunft und fehlender Zeitstempelnachweis
  bleiben vorgelagerte harte Gates. `snapshot.stale` überschreibt eventbasierte
  Liveness nicht.
- Auswahl, veröffentlichte Feldqualität, Fallback-Diagnose, Owner-Gate,
  Shadow-Verifikation und Live-Evidence verwenden dieselbe Bewertung.

## Diagnose und Kompatibilität

Diagnosen zeigen Kadenz und Herkunft, Wert- und Liveness-Zeitstempel samt Alter,
Liveness-Ergebnis, Plausibilisierung sowie die Anzahl gleich konfigurierter
Bindings. Die strukturierte Bewertung nimmt nicht an der Dataclass-Gleichheit
teil und löst daher durch fortschreitende Zeit keine `QUALITY_CHANGED`-Events
aus. Registry-v1 und Bindings ohne neue Felder verhalten sich unverändert.

## Verifikation und Live-Grenze

Backend-, Listener-, Gate-, Consumer- und Frontend-Tests decken alle drei
Kadenzen, die drei Liveness-Plausibilisierungsfälle, den unbekannten Zustand,
die harten Gates und den Opening-Fall ab. Installation, HA-Neustart,
Registry-Aktivierung und Live-Verifikation bleiben Benni vorbehalten.
