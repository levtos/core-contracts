# Core Contracts — Alpha 1 Build Specification (Build-Lastenheft)

**Status:** Build Candidate Baseline · Stand 2026-10-07
**Fachliche Freigabe:** `READY FOR BUILD` · **Technische Freigabe:** `TECHNICAL BASELINE CONFIRMED`
**Delta-Audit Profile:** `REMOVE CORE PROFILES FOR V1` · `NO FREEZE IMPACT`

## 0. Autorität und Leseregeln

1. **Primäre Build-Quelle** ist dieses Dokument.
2. **Fachliche Rückfallquelle** ist
   `Core_Contracts_Master_Entscheidungsakte_Phase4_Auditrevision.md` (Stand einschließlich P4-65),
   im Folgenden „Fachakte“. Verweise wie `M30-05` oder `P4-60` beziehen sich auf sie.
3. Bei Widerspruch gilt dieses Dokument für alle hier **ausdrücklich konsolidierten Deltas**:
   Entfernung der Core-Profile, `installation_id`, Dokumentationskorrekturen D1–D3, technische
   Baseline, Thin HA I/O Bridge, kein Shadow-Modus, Alpha-1-UX-Scope. Für jede **sonstige
   Domain-Semantik** bleibt die Fachakte maßgeblich; dieses Dokument fasst sie zusammen und
   verweist auf die Fundstelle, ersetzt sie aber nicht.
4. Superseded und nicht als Quelle zu verwenden: `Core_Contracts_Master_Entscheidungsakte.md`,
   `…_Phase4.md`, `…_Step3b.md`, `…_Step3c.md`.
5. Historische Ist-Befunde der Fachakte (z. B. Code-Stand v0.2.4, `benni-core-state`, `media_state`)
   beschreiben Legacy und sind **keine** Soll-Vorgaben, sofern dieses Dokument oder ein
   Soll-Beschluss der Fachakte sie nicht ausdrücklich übernimmt.
6. Schlüsselwörter: **MUSS** = Pflicht für Alpha 1; **SOLL** = Pflicht, sofern technisch im
   Alpha-1-Rahmen möglich, sonst als Abweichung zu berichten; **KANN** = optional;
   **DARF NICHT** = verboten.
7. Zahlenwerte, die die Fachakte als Parameter (`[P]`) oder Parameter-Audit führt, sind
   **Konfiguration**. Sie werden in der Registry gesetzt und sind keine versteckten Code-Defaults
   (siehe §10.6).

---

## 1. Scope

Alpha 1 ist die **erste funktional vollständige Implementierung der Zielarchitektur** von
Core Contracts:

- Core-Contracts-Runtime als **Supervisor-verwaltete Home-Assistant-App** (eigener Container).
- **Thin HA I/O Bridge** als minimale HA-Custom-Integration (nur Transport).
- **PostgreSQL** als autoritative Persistenz für Registry, Zustand, Historie und Restore-Kontext.
- Die neun Bausteine (M30-16): Registry/SourceBinding · Contract/Schema · Resolver · Temporal ·
  Fusion · State Machine · Quality/Freshness/Evidence · Scheduler/Clock · Consumer API.
- **CoreContractsClient** (Python) und öffentliche HTTP/WebSocket-API.
- Ein **Referenz-Contract-Katalog** (§6.8) mit Pflicht- und Folgestufe.
- Minimale **Engineering-/Admin-Oberfläche** über Supervisor Ingress.
- Ernsthafte automatisierte Tests, Packaging (amd64/aarch64), Betriebsdokumentation.

Alpha 1 ist **kein** Produktionsversprechen. Integrationsrisiken dürfen noch gefunden werden, UX darf
rudimentär sein, Kompatibilitätsnachweise dürfen ausstehen. Persistenz, Restore, Quality und Tests
dürfen **nicht** vereinfacht oder vorgetäuscht werden.

## 2. Ziele

1. Kanonische fachliche Wahrheiten genau einmal, mit expliziter Quality, Freshness, Evidence und
   Reasons, berechnen und veröffentlichen.
2. Fachlichen Owner (App) und HA-Lebenszyklus trennen: Ein HA-Neustart ist bei weiterlaufender App
   ein Reconnect, kein Core-Restore (APP-01, M18-16).
3. Zustand, Episoden, Deadlines und Historie persistent und restore-fähig halten (CP-15, M12-05, M12-11).
4. Eine stabile, versionierte, UI-neutrale Consumer-Grenze (`CoreContractsClient`) bereitstellen.
5. Jede Home-Assistant-Installation ist ein vollständig isolierter Core-Kontext (§11).
6. Die beschlossenen Invarianten der Fachakte automatisiert testen.

## 3. Nicht-Ziele (Alpha 1 baut ausdrücklich nicht)

Microservices · Kubernetes · Redis · Kafka · RabbitMQ · Clusterbetrieb · Multi-Writer ·
Multi-Tenant-Core · **Core-Profile** · Cross-HA-Federation · **Shadow-Modus** · vollständige
Umbrella-UX · Drag-and-Drop-Workbench · visueller Regel-/State-Machine-Designer ·
Node-RED-/Blockly-artige Systeme · generisches Plugin-System · generisches `set_state` ·
Policy- oder Apply-Hosting im Core · HA-Entity-Projektionen (vertagt, §30) ·
Climate-, Plug- oder Door-Redesign · vollständige automatische Migration aller Legacy-Daten ·
MQTT als Contract-Bus · freie Formel-/Ausdruckssprache (Jinja, Python, Templates).

## 4. Terminologie

| Begriff | Bedeutung |
|---|---|
| **Installation** | Eine Home-Assistant-Installation mit genau einer Core-Contracts-App, eigener DB und eigener Registry. Vollständig isolierter Core-Kontext. |
| **`installation_id`** | Stabile technische UUID der Installation (§11). Einzige Isolationsidentität. |
| **`installation_label`** | Rein anzeigender Name (z. B. „Benni“, „Eltern“). Niemals in Logik oder IDs. |
| **Source** | Konfigurierte Rohquelle (HA-Entity, HA-Entity-Attribut, MQTT-Topic, Scheduler, Command-Kanal). |
| **SourceBinding** | Bindet genau eine Source lesend an einen Eingang eines Contracts bzw. Kandidatenrechners. |
| **Observation** | Ein einzelner Eingang aus einer Source mit allen Zeitstempeln und Herkunft (§8.1). |
| **Evidence** | Fachlich verwendbare Observation(s), die einen Contract-Wert tragen. |
| **Contract** | Kanonische fachliche Wahrheit mit Schema, Version und Instanz-ID. |
| **Contract-Instanz** | Konkrete Ausprägung eines Schemas in einer Installation (z. B. `opening.living_room_window_left`). |
| **Producer** | Genau ein autoritativer Berechnungspfad je Contract: Resolver, Fusion oder State Machine (M30-08). |
| **Kandidat** | Internes Zwischenergebnis eines Kandidatenrechners vor einer abschließenden Fusion. Nie publiziert. |
| **Transformation** | Normalisierung, `map`, `bucket`, Debounce — erzeugt Kandidaten, keinen Contract. |
| **Status** | Einer von `valid`, `held`, `unknown`, `not_applicable`, `unresolved` (M30-01). |
| **Quality** | `healthy` oder `degraded` je Feld; getrennt von Status, Freshness, Connectivity. |
| **Reason** | Maschinenlesbarer Grund aus einem zentralen, generischen Katalog (§7.4). |
| **Grace** | Ausdrücklich je Contract definierte, befristete Haltezeit; erzeugt Status `held`. |
| **Registry-Revision** | Unveränderliche, versionierte Gesamtkonfiguration einer Installation. |
| **Draft** | Bearbeitbarer Registry-Entwurf. Wird nie ausgewertet. |
| **Publication** | Atomar committeter und veröffentlichter Berechnungsstand; trägt `publication_seq`. |
| **Runtime-Epoche** | Abschnitt ununterbrochener autoritativer Fortschreibung; neue Epoche nach Start, Lock-Verlust, DB-Recovery. |
| **Policy** | Externe Komponente, die auf Wahrheiten reagiert (nicht Core). |
| **Apply / Controller** | Externe Komponente, die Aktionen ausführt (nicht Core). |
| **Bridge** | Thin HA I/O Bridge (HA-Custom-Integration `core_contracts_bridge`). |
| **Pre-Sleep** | Zielmodell-Begriff für das frühere `provisional_sleep` (P4-51). |

## 5. Ownership

### 5.1 Grundsatz (M30-23, M04-14, P4-05, P4-35)

| Ebene | Verantwortung | Ort |
|---|---|---|
| **Core Contracts** | Was ist wahr? Jede Wahrheit genau einmal; Wert + Status + Quality + Freshness + Evidence + Reasons. | Supervisor-App |
| **Policy** | Was soll aufgrund der Wahrheit geschehen? Fail-open/fail-closed, Komfortschwellen, Reaktionen. | außerhalb Core |
| **Apply / Controller** | Ist es erlaubt und ausführbar? Führt aus. Control Permission (M30-24). | außerhalb Core |
| **Bridge** | Transportiert HA-I/O. Keine Wahrheit. | HA Core |
| **CoreContractsClient** | Zugriffsschicht. Keine Wahrheit, keine Neuinterpretation. | Consumer-Prozess |
| **Admin-UI** | Anzeige und Administration über öffentliche API. Keine Wahrheit. | Ingress |

### 5.2 Verbindliche Grenzen

- Core erfindet oder verändert keine Wahrheit, um Sicherheit zu erzwingen (M15-03, M30-23).
  Beispiel: Ein ausgefallener Fenstersensor wird im Core `unknown` mit Reason, nie `open`.
  Die Blind-Policy behandelt ihn safety-seitig wie `open` (P4-65 §4).
- Fail-safe-Entscheidungen gehören zur Policy (M15-04).
- Schwellen werden nach Zweck eingeordnet (A-10): Klassifikationsschwellen (`bright`, `dark`,
  `device_active`) sind Core-Konfiguration; Reaktionsschwellen sind Policy.
- Keine Doppel-Detektion: Consumer bauen Rohbedingungen nicht nach (M04-06, M04-13).
- Kein konkurrierender Truth-Producer in Bridge, Client, API, MQTT, Frontend oder HA-Projektionen.
- Policy-Profile (Komfort-, Heiz-, Haushalts-, Parameterprofile) sind Policy-Konfiguration und
  **keine** Core-Identitätsdimension.
- Kein Apply im Core. Ausnahme ist ausschließlich die technische **Aktualisierungsanforderung**
  an Quellen im Rahmen der Presence-Reconciliation (§6.8, P4-62 §7); sie ist I/O, keine Aktion
  auf Geräte.

## 6. Domain- und Contract-Modell

### 6.1 Bausteine (M30-16, kein zehnter Baustein)

1. **Registry/SourceBinding** — Konfiguration, Quellen, Bindings (§10).
2. **Contract/Schema** — code-definierte, versionierte Schemas mit Value-Catalog (M07-02, M07-04, M30-17).
3. **Resolver** — typisierte Knoten ohne freie Ausdruckssprache (M04-11, M08-03, M30-10).
4. **Temporal** — `dwell`/`stable_for`, `grace`, `delta`, `age` (M10-02).
5. **Fusion** — nur zwischen Kandidaten **derselben** Wahrheit (M30-08).
6. **State Machine** — Zustände, Transitionen, Guards, Commands, Episoden, Deadlines, Sessions (M11-01 ff., M30-29).
7. **Quality/Freshness/Evidence** — §7, §8.
8. **Scheduler/Clock** — einzige Zeitquelle (M10-04, M30-14, §18).
9. **Consumer API** — §15.

### 6.2 Contract-Identität

- `contract_id` ist installationslokal, stabil und beschreibt Bedeutung, nicht das aktuelle Gerät
  (M06-04): z. B. `activity`, `presence.benni`, `opening.living_room_window_left`. Generationsneutral
  (`gaming.playstation`, nicht `gaming.ps5`).
- **Kein Profil- und kein Installations-Präfix** in `contract_id` (§11).
- Kanonische Werte nutzen hierarchische Punktnotation, wo die Semantik Spezialisierung verlangt
  (M07-03): `<state>[.<specialization>]`. **Keine** universelle Variant-Mechanik.
- Werte sind Einträge im Value-Catalog des Schemas; keine Value-UUIDs (M07-04).
- Darstellungsmetadaten (`display_name`, `description`) sind von der Identität getrennt (M07-05).
- Ein Contract existiert unabhängig von einer HA-Entity (M07-12).

### 6.3 Schema

Jedes Schema ist **code-definiert** und unveränderlich je Version (M30-17):

```text
schema_id, schema_version, lifecycle (active|deprecated|retired),
fields: { name: { type (bool|number|enum|text|timestamp|object),
                  required (bool),
                  physical_state (bool),
                  value_catalog (für enum: id, display_name, description),
                  unit (optional), quantity (optional) } },
available_projection: [Feldnamen] (optional, M08-14),
grace_allowed (bool) + grace_parameter (Name des Registry-Parameters, falls erlaubt)
```

Regeln:
- Neue Semantik → neue `schema_version`; Bugfix → gleiche Version; keine automatische Migration;
  Versionsnummern werden nicht wiederverwendet.
- Physische Zustandsfelder erzwingen `fallback = reject`; ein `safe_default` ist für Schloss und
  Position verboten (M15-09). Für Alpha 1 gibt es keinen `safe_default` und kein `hold_last`.
  Halten erfolgt ausschließlich über eine ausdrücklich definierte Grace.
- „Nicht konfiguriert“ ist **Konfigurationsvollständigkeit** (Validierungsbefund bzw. Reason
  `config_incomplete`), nicht `not_applicable` (P4-32, F-51 (3)).
- Die historische Schema-Skizze `activity` v1 (`active`, `variant`, `available`) ist **keine**
  Felddefinition (D3). Für Activity gilt §6.8 A7.

### 6.4 Producer-Pfade (M30-08, A-08)

- **Transformation** (`map`, `bucket`, Normalisierung, Debounce) → interner Kandidat, kein Contract,
  keine Zwischen-Contracts.
- **Resolver mit einem Berechnungsweg** darf direkt publizieren.
- **Mehrere Berechnungswege** derselben Wahrheit liefern nur interne Kandidaten. Genau eine
  abschließende Fusion publiziert: `Kandidatenrechner → Kandidaten → Fusion → Contract`.
- **State Machine** ist direkter autoritativer Producer:
  `Evidence/Kandidaten → ggf. Fusion → State Machine → Contract`. Hinter einer SM gibt es keine Fusion.
- **Single-Producer** je Contract. Mehrere gleichzeitig autoritative Wahrheiten desselben Contracts
  sind unzulässig. Die Registry-Validierung MUSS das erzwingen.
- Guards und Transitionen referenzieren kanonische Contracts, nie Roh-Entities (M30-09).
- Der Contract-Graph ist azyklisch. Zyklen werden bei Validierung abgewiesen (M04-12, M08-12).

### 6.5 Resolver-Operatoren

Typisierte Knoten; jede Ausgabe trägt Status, Quality und Reasons der ergebnisbestimmenden Eingänge
weiter (M08-14):

| Operator | Semantik | Quelle |
|---|---|---|
| `compare` | `==, !=, in, not_in, <, <=, >, >=` → Boolean | M08-03 |
| `and`, `or`, `not` | dreiwertig; `unknown` ist nie `false` | M08-03, M15-02 |
| `first_match` | geordnete Fälle → Enum; **strenge Auswahl** (M30-04): Ein höherer Kandidat mit unbekanntem entscheidendem Pflicht-Eingang blockiert niedrigere → `unresolved` + `degraded` + Reason. Contractspezifische Ausnahmen nur explizit. | M08-06, M30-04 |
| `map` | kategoriale Übersetzung; ungemappt → `unmapped_value` | M30-10 |
| `bucket` | numerisch → n Klassen; optional Hysterese an Grenzen; Boolean = 2 Klassen; **einziger** zustandsbehafteter Resolver-Operator; Pflicht-`initial` (Klasse oder `unknown`); ungültiger Eingang → `unknown` + Latch-Reset | M30-10, M30-11, M30-12 |
| `formula` | Eintrag aus dem code-definierten, versionierten Formelkatalog (typisierte Inputs mit `quantity`/`required`); keine freie Formel | M30-15 |
| `age` (Zeit als Input) | nur über Scheduler/Clock | M08-21 |

Kein verstecktes Zeit- oder Zustandsgedächtnis in Resolvern; keine Ad-hoc-Timer (M30-11).

### 6.6 Fusion (M09-01/02/05, M30-02, M30-08)

Generische Strategien: `first_healthy`, `latest` (nach **Messzeit**, nie Empfangszeit),
`any_true`, `all_true` (dreiwertig; fehlend, `unknown` oder stale zählt nie als `false`), auch verschachtelt.
Spezialstrategie: `opening_contacts` (code-definiert, asymmetrisch, §6.8 A1). `rank` gibt es nicht.

- Ein nicht auflösbarer Konflikt derselben physischen Wahrheit ergibt `unknown` + `degraded` +
  `reason = conflict` (M30-02).
- Solange tragfähige Kandidaten bleiben, wird über Quality und Reason degradiert, nicht `unknown`.
- Es gibt keine allgemeine Regel „Quelle A gewinnt immer“. Prioritäten sind contractspezifische
  Konfiguration.
- Fusion ist Datenverarbeitung, keine Policy (M09-04).

### 6.7 State Machines (M11-01 ff., M30-29)

- SM-**Typen** sind code-definiert und versioniert (Zustände, Transitionen, Guards, Commands,
  Deadlines, Episodenregeln). Die Registry instanziiert sie mit Bindings und Parametern.
- **Commands fordern Transitionen an.** Die SM prüft die Guards. Eine abgelehnte Anforderung wird mit
  `result = rejected` und Reason protokolliert (M11-04, M13-01). Ein generisches `set_state` gibt es
  nicht (M30-25).
- Ein Event muss keinen Zustandswechsel auslösen; dasselbe Signal kann je Zustand unterschiedlich
  wirken (M11-06, M11-07).
- **Episoden** (M11-10, M11-11): Ein Episodenende beendet die Episode, ein späterer Wiedereintritt
  ist eine neue Episode. Pro Episode bzw. Übergang werden mindestens gespeichert: `episode_id`,
  `state`, `started_at`, `ended_at`, `previous_state`, `transition_reason`, `trigger/source`,
  Evidence-Referenzen, `registry_revision`, `origin` (`automatic | manual | restore`).
- **Deadlines** sind absolute UTC-Zeitpunkte, relativ zum Episodenanker berechnet (M13-02).
  Sie werden nie ab Restore-Zeitpunkt neu gestartet.
- **Sessions** gibt es nur dort, wo fachlich beschlossen (Streaming-Session-Gedächtnis M30-06,
  Gaming-Session M30-21). Es gibt keine Session-Pflicht und kein universelles Session-Modell (M30-29).
- Es gibt keine globale Contract-Hierarchie und keine Scenario-Contracts (M30-07).

### 6.8 Referenz-Contract-Katalog Alpha 1

Feldnamen in diesem Abschnitt sind die **technische Festlegung für Alpha 1**. Die Fachakte lässt
Feld- und Enum-Namen bewusst offen; sie werden hier ohne neue Semantik bestimmt. Die fachlichen
Regeln stehen in den angegebenen Fundstellen und MÜSSEN von dort vollständig implementiert werden.

**Stufe A (MUSS):**

| # | Contract | Producer | Felder (Alpha 1) | Fachliche Regeln |
|---|---|---|---|---|
| A1 | `opening.<id>` je Öffnung | Fusion `opening_contacts` | `state` ∈ `closed, tilted, open` | P4-65 §1–§3, §6, §9–§10; M08-15; M15-03. **Asymmetrie:** Ein eindeutiges frisches `open` gilt sofort (`degraded`, Reason `partial_evidence`, falls nur ein Kontakt). Einzelnes frisches `closed` oder mehrdeutiges „nicht zu“ → Grace → `unknown`. Frischer Kontaktkonflikt → sofort `unknown` + `conflict` ohne Grace. Grace-Dauer = Parameter. Freshness über Heartbeat/`last_seen`/`last_reported`, nicht über das Alter des Zustands. Kein Core-Zonenaggregat. |
| A2 | `room_temperature.<zone>`, `room_humidity.<room>`, `outdoor_climate` (Temperatur/Feuchte) | Fusion `first_healthy` | `temperature_c` bzw. `humidity_pct`; `origin_class` ∈ `measured, model, forecast, substitute` | P4-65 §11.4 #3, #4, #8; Freshness passend zum Meldetakt (Parameter); Herkunft je Wert sichtbar. Plausibilität/Stuck-Erkennung (M14-05) KANN als Reason `suspicious` umgesetzt werden, nur wenn konfiguriert. |
| A3 | `presence.<subject>` | State Machine `presence_v2` | `place` ∈ `home, parents, away`; `away_confirmed` (bool); `distance_m`; `direction` ∈ `approaching, leaving, stationary`; `since_at` | M30-22, P4-56 (max. 6 min `held`, dann `unknown`), P4-57 (`away_distance_threshold_m` > `home_distance_threshold_m`, Zwischenzone hält den letzten bestätigten Zustand ohne `held`), P4-62 (frische `parents`-SSID vor GPS im Home-Radius; Proximity-Fakten mit eigener Quality; Reconciliation-Trigger ≠ Evidence; begrenzte Wiederholungen konfigurierbar), P4-51 (lokale Home-Evidence nicht von einzelner Remote-GPS-Messung überschrieben). Kein Activity-Hold, keine Transition-Zustände (`leaving`, `arriving`, `coming_home` = Legacy). `parents` ist ein eigener Ort; Reaktionen sind Policy. |
| A4 | `bio.<subject>` | State Machine `bio_v2` | `state` ∈ `awake, pre_sleep, sleep, waking`; `since_at`; `episode_id`; `pre_sleep_deadline` (UTC); `sleep_origin` ∈ `manual_confirmation, inferred_timeout, inferred_tv_off`; `sleep_context_active` (bool = `pre_sleep` ∨ `sleep`) | M30-18, M30-19, M30-41 (P4-60) vollständig, M11-04/05/08/09/10/15/16/17/19, A-01, A-02, P4-50a, P4-51. Pre-Sleep nur bei Presence `home` + zulässiger Phase + TV an + kein harter Blocker (PC). 45-min-Deadline ab Episodenbeginn; Reset nur durch zugelassene Interaktionssignale (Allowlist = Konfiguration; Flur-Flanke `off→on`; Origin-Regel P4-60 §2; Denon-Regel P4-53). TV/PC `unknown` in Pre-Sleep = Hold der laufenden Deadline (P4-60 §5). Wake aus Sleep nur durch Fenster, Terrassentür, Kaffeemaschine, PC; `away_confirmed` → `awake`. `waking` aus `wake.plan`, Ende bei erster Wake-Evidence oder spätestens 60 min. Kein allgemeines `set awake`. Bio-State hat keine Grace (P4-56). Activity und Bio sind entkoppelt (P4-51). |
| A5 | `wake.plan` | Planner (1:1-Port) | `next_wake_start` (UTC), `plan_status`, `basis` (regular, calendar, manual_exception, min_sleep), `exception` | P4-60 §9–§10: 1:1-Port der deterministischen Planungslogik aus `Levtos/benni-core-state` (Werktag/Wochenende, Feiertage, Floor, Korridor, Termin-/Kalenderbezug, Mindestschlaf nur Wochenende/Feiertag ab `sleep`). Die Vorlaufformel wird aus dem Code dokumentiert; keine neue Zahl. Manuelle Ausnahme = Command. |
| A6 | `day_phase` | Scheduler/Clock + Resolver | `phase` (9 Phasen, Namen 1:1 aus `benni-core-state`) | M30-20: 9-Phasen-Logik 1:1, kein separates Modul. |
| A7 | `tv.actual_source`, `activity` | Resolver + `map`-Katalog + Temporal + SM (Streaming-Session) | `tv.actual_source`: `source` (kanonisch), `source_class` ∈ `managed, manual`. `activity`: `activity` ∈ `idle, tv, streaming, gaming, gaming.playstation, gaming.pc, pc, other`; `service` (Subkontext, z. B. Streaming-App, sonst `not_applicable`); `title` (Spieltitel, sonst `not_applicable`); `streaming_session` (bool, getrenntes Gedächtnis) | M30-04, M30-05, M30-06, M30-13 (`tv.source`-Grace max. 5 s, nie bei sicherem TV aus), M30-31 bis M30-36, M30-39, M30-40 (P4-50 bis P4-59). Genau eine primäre Tätigkeit. `other` + `activity_mapping_missing` nur für bekannte gebundene Source ohne Mapping (nicht zuweisbar). Nicht gebundene Rohwerte → strenge Auswahl (`unmapped_value` / `unresolved`). TV-/PC-Arbitration: zuletzt aktivierter Zweig gewinnt, Rückfall auf den verbleibenden, `unresolved` nur bei nicht bestimmbarer Reihenfolge. PC-Zweig über `host_status`; Discord `playing` → `gaming`. ATV + TV sicher an → `streaming` ohne Playback-Nachweis (A-09). `desired_source` (Policy) wirkt nie zurück. |
| A8 | `outdoor_brightness` | Kandidaten + Fusion + `bucket` mit Hysterese | `class` ∈ `dark, bright` | P4-64 §3: Garten-Lux primär, Strahlung sekundär, Sonnenhöhe als Plausibilität; Innen-Lux ungeeignet; Tagesphase ist keine Helligkeits-Evidence. Schwellen = Parameter. Ein ausgefallener Einzelsensor bedeutet nicht automatisch `unknown`. |
| A9 | `simulation_state` | Resolver/SM | `state` ∈ `inactive, active` | P4-64 §5: `active` = Presence `away` ∧ `outdoor_brightness = dark` ∧ Tagesphase im Simulationsfenster (Grenzen = Parameter). `home`/`parents` → sofort `inactive`. `parents` löst nie Simulation aus. Unbekannt → ehrlich `unknown`. |
| A10 | `connectivity` | interne Monitore + Bindings | je Abhängigkeit `<dependency_id>`: `state` ∈ `ready, starting, unavailable` (HA), sonst `available, unavailable` | P4-64 §7 (I-1), P4-65 §7: pro technischer Abhängigkeit (HA, MQTT, Zigbee2MQTT, WAN, …); Heartbeat-basiert; ohne Heartbeat `unknown`; kein Master-Gate; nie positive Evidence für Fachwahrheiten; Abhängigkeitsausfall erscheint an betroffenen Contracts nur als Reason `dependency_unavailable`. HA-Eintrag: `starting` länger als `ha_starting_timeout_s` (Parameter) → `unavailable`. PostgreSQL ist **kein** Eintrag hier, sondern Selbstdiagnose/Readiness. |

**Stufe B (SOLL, nach Abschluss von Stufe A; nicht Fertiggestelltes als Alpha-Limit berichten):**

| # | Contract | Regeln |
|---|---|---|
| B1 | `privacy_context` (`inactive, private_time, date_time`) | P4-63 §4: orthogonal, kein Activity-Wert, keine Priorität. Private Time automatisch aus den in P4-63 §4 genannten Stream-Quellen (PC; Apple TV, sobald technisch belegt), 10 s Grace (Parameter). Date Time per Command, Ende per Command oder `sleep`. Keine Bio-Wirkung. |
| B2 | `gaming_session` (PS5) | M30-21, M11-21: allgemeines SM-Restore-Modell; „PS5 läuft“ bestätigt keinen Modus. |
| B3 | `expected_radiation.<facade>` | K1, Katalog #11: Port der bestehenden Blind-Control-Berechnung (C-06); WAN als Connectivity-Reason. |
| B4 | Wetter-Ergänzungen: Wind, Niederschlag gemessen, Prognose-Reihe | Katalog #9, #12, #13 mit `origin_class`. |
| B5 | Formeln `dew_point.v1`, `absolute_humidity.v1`, `apparent_temperature.v1` | Katalog #10 über den Formelkatalog. |
| B6 | Bad-Ereignisse (Dusche/Toilette) als Event-Contract; Thermostat-Gerätewahrheit | Katalog #7, #14. |

Für `parents` gilt in allen Consumer-Beschreibungen ausschließlich die aktuelle Regel:
**Für Blind/Sichtschutz wie `home`** (P4-64 R-1a), **für Media wie `home`** (P4-63 M-F),
**Climate darf wohnungsnah behandeln** (P4-62 §4). Core selbst bewertet `parents` nie um; aus
`parents` wird kein Sleep abgeleitet.

**Übergang (P4-65 §11.4 [M]):** Presence und Bio DÜRFEN vorübergehend über Bindings an
`benni-core-state`-Entities gespeist werden. Voraussetzungen: Kennzeichnung `origin = legacy_source`
und eine erklärte Abweichungsliste. Das spätere Umbinden erzeugt keine Flanke (A-06). Core führt
dabei keine Legacy-Logik als zweite Wahrheit aus.

## 7. Quality

### 7.1 Status (M30-01)

| Status | Bedeutung | Wert | Quality |
|---|---|---|---|
| `valid` | aktuell bestätigte Wahrheit | gesetzt | `healthy` (oder `degraded`, wenn Teil-Evidence) |
| `held` | letzter bestätigter Wert innerhalb einer **ausdrücklich definierten** Grace | gesetzt + `held_until` | `healthy`, Reason sichtbar |
| `not_applicable` | im aktuellen Weltzustand gibt es fachlich keinen Wert; **nur bei positiver Feststellung** | `null` | `healthy` |
| `unknown` | Wahrheit sollte existieren, ist nicht bestimmbar; **nie ohne Reason und betroffenen Input** | `null` | `degraded` |
| `unresolved` | Auswahl hat Kandidaten, aber keinen eindeutigen Gewinner | `null` | `degraded` |

Verboten: `unknown → false`, `unknown → Ersatzwert`, Ersatz-Fachwerte (`no_source`, `error`, …),
`restored` als Status oder Quality, Connectivity als Quality, Freshness als Boolean-Ersatz für Quality,
„persistiert = valid“.

`unknown` und `unresolved` sind systemweit problematisch und werden zentral sichtbar gemacht
(Diagnostics-Endpunkt „Probleme“, strukturierte Logs).

### 7.2 Held-Propagation (A-04)

- Eine Ableitung, deren Ergebnis entscheidend auf mindestens einem `held`-Eingang beruht, ist selbst
  `held`. `held_until` ist das **früheste** Grace-Ende der tatsächlich ergebnisbestimmenden
  gehaltenen Eingänge.
- Eine Auswertung eröffnet **nie** eine neue Grace und verlängert keine. Gehaltene Eingänge dürfen
  keine Grace-Kette erzeugen.
- Trägt andere belastbare Evidence das Ergebnis unabhängig, propagiert der Held-Eingang nicht.
- Nach Ablauf wird mit der dann zulässigen Evidence neu bewertet.
- `held` ist **nicht** pauschal `valid` für Temporal-Bedingungen. Jede Temporal-Bedingung deklariert
  `accepts_held` (Default `false`). `true` ist nur zulässig, wo die Fachakte es festlegt
  (z. B. P4-60 §5 für die Pre-Sleep-Deadline).
- Consumer dürfen `held` unterschiedlich behandeln (Climate akzeptiert `held` nicht als Heizfreigabe).

### 7.3 Feld- und Contract-Aggregation

- Quality, Status und Reasons gelten **je Feld**.
- `contract_health` wird nur aus den **Pflichtfeldern** aggregiert: `degraded`, sobald ein Pflichtfeld
  `degraded` ist. Optionale Felder bleiben einzeln sichtbar (Behebung von B5).
- `available` ist eine Projektion von Quality für die im Schema deklarierten Felder. Wahr, wenn alle
  verwendbar sind (`valid` oder `held` innerhalb Grace, kein Konflikt). Nie `unknown`, nie gebunden,
  kein Fallback (M08-14, A-04).

### 7.4 Reason-Katalog (zentral, generisch, M30-01)

Initialer Katalog Alpha 1. Erweiterungen sind generisch, nie gerätespezifisch.

| Code | Verwendung |
|---|---|
| `input_unavailable` | Quelle meldet nicht verfügbar / absent |
| `input_unknown` | Quelle meldet unbekannt |
| `input_stale` | Freshness verloren |
| `input_restored` | Quelle trägt nur HA-/MQTT-restaurierten Wert (Freshness-Gate) |
| `unmapped_value` | `map` ohne Eintrag |
| `invalid_value` | Typ/Format ungültig |
| `no_match` | `first_match` ohne zutreffenden Fall |
| `conflict` | widersprüchliche frische Evidence derselben Wahrheit |
| `partial_evidence` | Teil-Evidence (z. B. ein Kontakt) |
| `source_transition_grace` | `held` innerhalb Grace |
| `selection_blocked` | strenge Auswahl blockiert durch unbekannten Pflicht-Eingang |
| `activity_mapping_missing` | bekannte gebundene Source ohne Activity-Mapping |
| `dependency_unavailable` | betroffene technische Abhängigkeit ausgefallen (mit `dependency_id`) |
| `config_incomplete` | Konfigurationsvollständigkeit |
| `restore_context_missing` / `restore_context_incompatible` / `restore_context_stale` | Restore-Startfälle (§9.4) |
| `history_gap` | Beobachtungs-/Historienlücke betrifft Kontinuität |
| `deadline_overdue_unprocessed` | überfällige Verpflichtung mit unbestimmbarem Verarbeitungsstand |
| `suspicious` | Plausibilität (nur falls konfiguriert) |

Jeder Reason trägt: `code`, `input` (Binding/Contract), `source_id` (falls zutreffend), `since`,
`detail` (optional, maschinenlesbar). Wording ist UI-Sache, kein Zustand.

## 8. Evidence und Freshness

### 8.1 Observation

Jede Observation trägt, soweit vorhanden und unterscheidbar:

```text
binding_id, source_id, source_kind (ha_state|ha_attribute|mqtt|scheduler|command),
source_origin (Alpha 1: immer "local"; reserviert für spätere Installationsherkunft, §10.7),
value_raw, value_normalized,
device_time (Gerätezeitstempel, z. B. Z2M last_seen / Payload-Zeit),
ha_last_changed, ha_last_updated, ha_last_reported, ha_time_fired, ha_context_id,
mqtt_retained (bool), mqtt_qos,
received_at (UTC, App), received_mono (nur Laufzeit),
observation_kind (value_change | report | snapshot | restore),
ha_restored (bool, HA-Attribut "restored"), assumed_state (bool)
```

### 8.2 Was eine neue physische Beobachtung ist

- **Neue Beobachtung:** ein echter Wertwechsel (`state_changed` mit neuem Wert oder Attribut),
  ein echter unveränderter Report bzw. Heartbeat (`state_reported`, neuer Gerätezeitstempel,
  neue MQTT-Nachricht mit neuem Gerätezeitstempel).
- **Keine neue Beobachtung:** Reconnect, Restore, Snapshot (eine Snapshot-Zeile zählt nur, wenn
  ihre Quellzeitstempel neuer sind als die bekannte letzte Observation), erneute Auswertung,
  erneute Publikation, MQTT-Retain allein, QoS-Duplikat, ein neuer HA-`last_updated` ohne Wert- oder
  Report-Grundlage (OS-G1).
- **Der Empfangszeitpunkt zählt nie als Frische** (M14-02). Fehlt eine Messzeit, wird sie nicht durch
  „jetzt“ ersetzt; die Observation ist dann nicht frisch-fähig (`freshness = unknown`).

### 8.3 Freshness je Binding

Jede Source MUSS ausdrücklich eine Freshness-Politik deklarieren. Es gibt keinen globalen TTL und
keinen impliziten Default (M14-09):

| Modus | Semantik |
|---|---|
| `report_heartbeat` | frisch, solange innerhalb `expected_interval_s` (× `stale_factor`) ein Report bzw. Heartbeat vorliegt (`last_reported`, `state_reported`, Gerätezeitstempel). Ein unverändert geschlossenes Fenster mit gültigem Heartbeat wird nie `stale` (P4-65 §3). |
| `liveness_entity` | Freshness aus einer separaten Liveness-Quelle (z. B. Z2M `last_seen`) gegen `expected_interval_s`; Zustände `alive, overdue, unknown` (M14-03). |
| `periodic_ttl` | Wert verliert nach `ttl_s` seit letzter Messzeit die Frische. |
| `event_stateful` | Zustandsquelle ohne Heartbeat (z. B. Schalter): Alter ist kein Qualitätsmangel (M14-06). Frische hängt an Availability und Connectivity der Abhängigkeit. |

Harte Gates vor jeder Freshness-Bewertung: restaurierter Wert (HA `restored`, Restore), MQTT-Retain,
fehlende Messzeit, Zeitstempel in der Zukunft (> erlaubte Toleranz, Parameter). TTL-Werte der alten V1
werden nicht ungeprüft übernommen (Parameter-Audit).

### 8.4 Ein Eingangspfad je Beobachtung

Pro realer Beobachtung gibt es genau **einen** autoritativen Eingangspfad: MQTT direkt **oder**
HA-vermittelt. Die Registry-Validierung MUSS erkennen, wenn dieselbe physische Quelle über beide
Pfade als unabhängige Evidence gebunden ist (deklarierte `physical_source_key` je Source), und die
Aktivierung abweisen.

### 8.5 `assumed_state`

`assumed_state = true` bleibt als Unsicherheit sichtbar. Ein Resolver kann den geratenen Wert
verwerfen, wenn belastbare andere Evidence (z. B. Watt) vorliegt (M14-07). Der Rohwert bleibt als
Evidence sichtbar.

## 9. Temporal und Restore

### 9.1 Temporal-Operatoren (M10-02, M30-13, M30-14)

| Operator | Semantik | Restore-Regel |
|---|---|---|
| `dwell` / `stable_for` | Bedingung muss für Dauer X durchgehend belastbar wahr sein | Anker `since_at` wird persistiert. Eine nicht ausdrücklich überbrückte Evidenzlücke (inkl. Core-Ausfall, DB-Ausfall, HA-Verbindungsverlust) **entwertet den Kontinuitätsnachweis**. Erneut wahr → neue Basis mit voller Dauer. Ausnahme: Kontinuität ist belegbar (§9.3). |
| `grace` | befristetes Halten **nur** wo ausdrücklich definiert (`tv.source` ≤ 5 s, Presence ≤ 6 min, Opening = Parameter, Private Time = Parameter) | `grace_until` (UTC) wird persistiert. Nach Restore läuft höchstens die Restzeit bis zur **ursprünglichen** Frist, und nur bei belastbar rekonstruierbarem Zustand. Nie eine neue Grace (OS-G2). |
| `delta` | Änderung über Fenster | nicht über Lücken fortgeschrieben |
| `age` | Dauer des aktuellen Werts | aus persistiertem `since_at`, sofern belastbar |

### 9.2 Zustandsbausteine und ihre unterschiedlichen Restore-Regeln

Es gibt **keinen** universellen Restore-Mechanismus. Jeder Baustein implementiert seine Regel:

| Baustein | Persistiert | Regel nach Restart / DB-Recovery |
|---|---|---|
| Stateless Resolver/Fusion | nein | aus aktueller zulässiger Evidence neu berechnen (CP-15 §3) |
| Source-Observation (letzte je Binding) | ja | als **historische** Evidence mit Originalzeitstempeln laden; nie frisch durch Restore |
| Hysterese-Latch (`bucket`) | **nein** | Neustart bei Pflicht-`initial`, danach ereignisgetrieben (M30-12, M08-08). Über eine Revisionsaktivierung im laufenden Prozess nur bei unveränderter fachlicher Grundlage übernommen (Semantik-Fingerprint). |
| Flanken-Baseline | ja (+ Semantik-Fingerprint) | weiterverwendbar bei gleichem Fingerprint; `unknown` überschreibt die Baseline nicht; Änderungszeitpunkt in einer Lücke bleibt unbekannt; sonst frische Basis (M30-03, A-06) |
| `dwell`/`stable_for`-Anker | ja | §9.1, §9.3 |
| Grace/held | ja (`grace_until`) | §9.1 |
| SM-Zustand, Episode, `since_at` | ja | validieren (§9.4); weiterverwenden, wenn belastbar |
| Absolute Deadlines | ja | Fälligkeit und Zuordnung bleiben; Überfälligkeit wird erkannt und nach geltender Regel ausgewertet, ohne auf ein neues Event zu warten; **kein Neustart der Frist**; unbestimmbarer Verarbeitungsstand → Reason `deadline_overdue_unprocessed` + Unsicherheitsregel, keine blinde Wiederholung (CP-15 §9) |
| Sessions (Streaming, Gaming, Private) | ja | validieren; „PS5 läuft“ bestätigt keinen Modus (M30-21); `restored ≠ held` |
| Commands | ja (Log) | werden **nie** wiederholt; historische Commands werden nicht zu neuen Commands (CP-15) |

### 9.3 Belegbare Kontinuität (technische Auslegung von M30-14)

Ein persistierter `since_at`-Anker bleibt über eine Lücke nur dann Kontinuitätsnachweis, wenn:
(a) die Temporal-Bedingung die Überbrückung ausdrücklich akzeptiert und die Lücke innerhalb einer
bestehenden Grace liegt, **oder** (b) jede ergebnisbestimmende Source nach der Lücke eine
quellseitige Wertänderungszeit liefert (HA `last_changed` oder Gerätezeitstempel der letzten
Wertänderung), die **vor** dem Anker liegt, bei unverändertem Wert und aktuell gültiger Freshness.

Sonst ist der Anker als Kontinuitätsnachweis ungültig. Dies ist **kein** Reset von Episoden,
Deadlines oder Zeitankern allgemein.
**Review-Punkt:** Diese Auslegung ist im Alpha-1-Review ausdrücklich gegen M30-14 zu prüfen.

### 9.4 Restore-Ablauf (CP-15 / M12-11)

1. Startfall bestimmen. Unterscheidbar MÜSSEN sein: echter Erststart (Contract-Instanz nie aktiv
   gewesen, belegt durch `contract_lifecycle.first_activated_at = NULL`), Restart mit gültigem,
   veraltetem, revisionsinkompatiblem, teilweise brauchbarem oder fehlendem Kontext.
   **Fehlender Kontext beweist keinen Erststart.**
2. Kontext laden und validieren: Revision/Semantik-Fingerprint, Vollständigkeit,
   Episode-/Deadline-/Grace-Zuordnung, Abhängigkeiten, Cross-Contract-Invarianten.
3. Aktuelle Evidence einlesen (HA-Snapshot, MQTT, Clock). Historie ergänzt die Gegenwart, verdrängt
   aber keine belastbare aktuelle Evidence (CP-15 §6).
4. Neu auswerten nach den Bausteinregeln (§9.2). Restore erzeugt **keine** Flanke, keine Grace,
   keinen neuen Beginn und keine erfundene Kontinuität. Nicht beobachtete Zwischenereignisse werden
   nicht rekonstruiert.
5. Unbestimmbare notwendige Wahrheit → `unknown` mit Reason. `unresolved` nur nach
   Auswahlsemantik, `held` nur in zulässiger Grace, `not_applicable` nur bei positiver Feststellung.
6. Die betroffene Lücke als `history_gap` speichern und sichtbar machen.
7. Abhängige Contracts nur aus einem konsistenten Berechnungsstand in **einer** Publication
   veröffentlichen (CP-08/F-23).

### 9.5 Revisionsaktivierung (M30-30, CP-17c Option A)

Bei Aktivierung wird vorhandene, fachlich verwendbare Evidence **einmal sofort** unter der neuen
Revision ausgewertet. Es gibt keine künstliche Flanke, keine Wiederholung alter Ereignisse und keine
Auffrischung von Zeitstempeln. Evidence einer alten Quelle wird nicht zur Evidence einer neuen Quelle.
Held bleibt nur in der bestehenden Grace. Es gibt keine rückwirkende `stable_for`-Kontinuität.
Baselines und Latches folgen §9.2 (Fingerprint). Der betroffene Abhängigkeitsbereich wird als
**ein** konsistenter Stand veröffentlicht; ein Mischstand aus alter und neuer Revision ist verboten.
Ein zuvor `unknown`/`unresolved` gewesenes Ergebnis darf durch die neue Regel bestimmbar werden.
Eine umbenannte Source mit gleicher Canonical-ID ist keine bedeutungsverändernde Umbindung (P4-53).

### 9.6 Semantik-Fingerprint

Jeder zustandsbehaftete Knoten hat einen deterministischen `semantic_fingerprint` (Hash über
Definition, Parameter, gebundene Sources und bedeutungsrelevante vorgelagerte Transformationen).
Anzeigenamen gehen nicht ein. Ein gleicher Fingerprint bedeutet: Zustand übernehmbar.

## 10. Registry und Bindings

### 10.1 Grundsätze

- Die aktive Registry liegt **autoritativ in PostgreSQL**. Je Installation gibt es genau eine aktive
  Revision.
- Revisionen sind unveränderlich, fortlaufend nummeriert und mit SHA-256 über die kanonische
  Serialisierung geprüft. Zustände: `active`, `superseded`. Abgewiesene Aktivierungen werden als
  Ereignis protokolliert, nicht als Revision.
- **Drafts** werden persistiert, damit Admin-Arbeit einen Neustart überlebt. Sie sind mit
  Draft-Version (OCC) versehen und werden **nie ausgewertet**.
- **Import** (Datei/JSON) erzeugt höchstens einen Draft und aktiviert nichts. Historische Evidence
  oder Fixtures werden nie produktiv aktiviert (M06-11).
- **Aktivierung** ist explizit, validiert, revisionsgeschützt
  (`expected_active_revision`) und atomar. Eine Aktivierung, die die Validierung nicht besteht,
  hinterlässt die aktive Revision unverändert.
- **Rollback** ist eine explizite neue Aktivierung. Der Inhalt einer früheren Revision wird als
  **neue** Revisionsnummer aktiviert. Die fachliche Historie wird nicht zurückgesetzt.
- Die Runtime verändert die Registry nie (M04-10).
- Eine leere oder automatisch zurückgesetzte Registry ist unzulässig. Ohne aktive Revision ist der
  Service nicht ready (§21).
- Export enthält keine Runtime-Zustände und keine Secrets (M06-11).

### 10.2 Konfigurationsschema (`config_schema_version = 3`)

```text
RegistryConfig {
  config_schema_version: 3
  dependencies: [ { dependency_id, kind (ha|mqtt|zigbee2mqtt|wan|dns|remote_site|other),
                    monitor (internal|binding), heartbeat_expected_interval_s? } ]
  sources: [ { source_id, kind (ha_state|ha_attribute|mqtt|scheduler),
               ha_entity_id?, ha_attribute?, mqtt_topic?, mqtt_value_path?, mqtt_time_path?,
               physical_source_key, dependency_id,
               freshness: { mode, expected_interval_s?, stale_factor?, ttl_s?, liveness_source_id? },
               display_name } ]
  contracts: [ { contract_id, schema_id, schema_version, enabled (bool),
                 producer: { kind (resolver|fusion|state_machine|planner|scheduler),
                             type (z. B. opening_contacts, bio_v2, first_match, …),
                             inputs: [ { name, ref: {binding_id | contract_id(.field)} } ],
                             graph?: [typisierte Resolver-/Temporal-Knoten],
                             parameters: { … } },
                 display_name, description } ]
  bindings: [ { binding_id, source_id, contract_id, input_name,
                value_map_ref? (nur über Resolver-Operator map), display_name } ]
  catalogs: [ { catalog_id, kind (map), version, entries } ]   # z. B. LG-Source-Klassen, Activity-Mapping
}
```

**Nicht vorhanden** (und von der Validierung abgewiesen, falls in Imports enthalten): `profile`,
`profile_id`, `consumer_ids`, Schema-`safe_default`, `hold_last`, `published`/`shadow`-Modi,
Allowlists für Projektion.

### 10.3 Validierung (vor Aktivierung, auch als Trockenlauf)

Typen, Schemas und Versionen; Graph azyklisch; Single-Producer je Contract; Referenzen aufgelöst;
Pflicht-Parameter vollständig (§10.6); `enabled`-Abhängigkeiten (ein aktivierter Contract darf
keinen deaktivierten Contract als Pflicht-Eingang haben); kein Doppelpfad derselben physischen
Quelle (§8.4); keine geheimnisverdächtigen Schlüssel; Probedurchlauf gegen die aktuell vorhandene
Evidence ohne Publikation (Ergebnis als Diff im Validierungsbericht).

### 10.4 `enabled` — kein Shadow-Modus

- Es gibt **keinen** Shadow-Modus und keinen parallelen Shadow-Betrieb.
- `enabled = true`: Der Contract wird mit Aktivierung der Revision produktiv ausgewertet, persistiert
  und veröffentlicht, also unmittelbar live, unabhängig davon, ob ein Consumer ihn nutzt.
- `enabled = false`: Der Contract wird weder ausgewertet noch publiziert. Die API meldet
  `contract_disabled` (API-Ergebnis, kein Quality-Status). Sein persistierter Zustand bleibt als
  Historie erhalten.
- Wird ein Contract wieder aktiviert, gelten Restore-Regeln mit Startfall „fehlender/veralteter
  Kontext“. Es gibt keine erfundene Kontinuität über die Deaktivierungszeit.

### 10.5 Bindings

Ein Binding liest genau eine Source, ausschließlich lesend; schreibende Bindings gibt es nicht. Ein Attribut darf als
Wert gelesen werden (`ha_attribute`, M06-09). `source_id` ist nach dem Anlegen fest; die
`ha_entity_id` darf zur Reparatur ausgetauscht werden. Kein stiller Quellenwechsel bei
Nichtverfügbarkeit (M06-14). Redundanz wird explizit über Fusion modelliert. Entity-Auswahl erfolgt
vom Benutzer bestätigt; automatische Vorschläge sind erlaubt, automatische produktive Zuordnung nicht (M06-11).

### 10.6 Parameter

Alle fachlichen Zahlenwerte (Grace-Dauern, Schwellen, Fenster, Retry-Werte) sind Registry-Parameter
des jeweiligen Contracts. Sind Werte in der Fachakte festgelegt, gelten sie als Pflichtwerte der
Beispielkonfiguration: `tv.source`-Grace ≤ 5 s, Presence-Grace 6 min, Away/Home 800/100 m,
Pre-Sleep 45 min, Waking max. 60 min. Werte unter Parameter-Audit werden in der Beispielkonfiguration
mit Kommentar `PARAMETER-AUDIT` vorbelegt. Code DARF NICHT stillschweigend einen fehlenden Parameter
ersetzen; fehlt ein Pflicht-Parameter, scheitert die Validierung mit `config_incomplete`.

### 10.7 Spätere Cross-HA-Quellen (nicht Alpha 1)

`source_origin` ist im Observation-Modell reserviert (Alpha 1: `local`). Eine spätere Fremdquelle wird
als Source mit Herkunfts-Installation und eigener Connectivity-Abhängigkeit modelliert. Die
konsumierende Installation bleibt alleiniger Owner ihrer Contracts. Kein Profil, keine Federation
in Alpha 1.

## 11. Installation Identity und Isolation

### 11.1 `installation_id`

- Wird beim **initialen Setup** einmalig als UUIDv4 erzeugt.
- Wird gespeichert in `/data/installation.json` (Bootstrap) **und** in der DB-Tabelle `cc_meta`.
- Wird bei **jedem Start** gegengeprüft. Abweichung → Start der Fortschreibung verweigert, Readiness
  `installation_mismatch`, deutliche Diagnose, keine Schreiboperation auf die DB.
- Ist sichtbar in `/api/v1/info`, im WS-Handshake, in Diagnostics, in Backup-Metadaten und in Logs
  beim Start.
- Ist **nicht** Teil von Contract-IDs, Source-IDs oder DB-Zeilen (eine DB je Installation).

### 11.2 Initialisierungsfälle

| `/data` | DB `cc_meta` | Verhalten |
|---|---|---|
| leer | leer (Schema neu) | Neue `installation_id` erzeugen, in DB und `/data` schreiben (Erststart). |
| ID X | ID X | normaler Start |
| ID X | ID Y | **Ablehnung** (`installation_mismatch`) |
| ID X | leer | **Ablehnung** (`database_uninitialized_for_existing_installation`); Initialisierung nur mit expliziter Option `initialize_empty_database: true` |
| leer | ID Y | **Ablehnung** (`bootstrap_missing`); Übernahme nur mit expliziter Option `adopt_installation_id: <Y>` |

Es gibt **keinen** Default-Kontext und keinen Fallback auf eine andere Installation. Der historische
Default `profile fehlt → benni` existiert nicht mehr, auch nicht in anderer Form.

### 11.3 Isolation (unverändert zwingend)

Getrennte Registry, Bindings, Contract-Instanzen, Evidence, Persistenz und Restore-Kontexte über
**eigene App + eigene logische Datenbank + eigene Rolle/Credentials** je Installation. Getrennte
API-Berechtigungen über installationsgebundene Tokens (§19). Gleiche Source-/Contract-IDs dürfen in
zwei Installationen unabhängig existieren. `installation_label` wird nie ausgewertet.

## 12. Persistenz (PostgreSQL)

### 12.1 Grundsätze

- PostgreSQL ist gesetzt; kein SQLite. Bestehende PostgreSQL-Infrastruktur wird verwendet; je
  Installation eine **eigene logische Datenbank** und **eigene Rolle**.
- Der physische Standort ist Deployment-Konfiguration. Wird eine WAN-abhängige DB verwendet, ist die
  Verfügbarkeitskopplung (§12.4) bewusst akzeptiert und dokumentiert.
- Treiber `asyncpg` (Ausgangspunkt 0.32.x, Lockfile entscheidet), **kein ORM**, keine private
  `asyncpg`-API. TLS über öffentliche Schnittstelle (`ssl=SSLContext`), `verify-full` mit
  konfigurierbarem CA-Zertifikat, wenn die DB nicht lokal ist.
- Pooling: kleiner Pool für Lesezugriffe/API (min 1, max 5, konfigurierbar) plus **eine dedizierte
  Verbindung** für Writer-Lock und Schreibtransaktionen. Kein PgBouncer im Transaction-Modus
  (Session-Advisory-Lock).
- Fachliche Zeitstempel kommen immer aus der App-Clock, nie aus DB-`now()`.

### 12.2 Tabellen (Alpha-1-Festlegung; Namen dürfen technisch verfeinert werden)

| Tabelle | Inhalt |
|---|---|
| `cc_meta` | Singleton: `installation_id`, `installation_label`, `created_at`, `db_schema_version`, `last_app_version` |
| `cc_schema_migrations` | `version`, `name`, `checksum`, `applied_at` |
| `runtime_epoch` | `epoch_id` (UUID), `started_at`, `ended_at`, `start_reason`, `end_reason` |
| `registry_revision` | `revision_no`, `config` (JSONB, kanonisch), `sha256`, `created_at`, `created_by`, `source` (draft/rollback/import) |
| `registry_activation` | `activation_id`, `revision_no`, `previous_revision_no`, `kind` (activate/rollback), `activated_at`, `activated_by`, `validation_report` |
| `registry_draft` | `draft_id`, `base_revision_no`, `draft_version`, `config`, `created_by`, `updated_at` |
| `contract_lifecycle` | `contract_id`, `first_activated_at`, `last_enabled_at`, `last_disabled_at` |
| `publication` | `publication_seq` (monoton je Installation, über Epochen fortlaufend), `epoch_id`, `registry_revision_no`, `committed_at`, `contract_ids` |
| `contract_state_current` | `contract_id` → aktueller Envelope (JSONB), `publication_seq` |
| `contract_state_history` | append-only: `contract_id`, `publication_seq`, `envelope`, `valid_from` (vollständiger Verlauf, M12-05) |
| `source_observation_current` | `binding_id` → letzte Observation (inkl. Heartbeat-Zeitstempel) |
| `source_observation_history` | append-only nur bei Wert- oder Availability-Wechsel (reine Heartbeats aktualisieren nur `current`) |
| `node_state` | `node_id`, `kind` (edge_baseline/dwell_anchor/grace/session/…), `semantic_fingerprint`, `payload` |
| `sm_instance` | `contract_id`, `state`, `since_at`, `episode_id`, `context` (JSONB), `semantic_fingerprint` |
| `sm_episode` / `sm_transition` | Episoden und Übergänge mit Pflichtfeldern aus §6.7 |
| `deadline` | `deadline_id`, `owner_node`, `due_at`, `episode_id`, `status` (pending/fired/cancelled/expired), `processed_at` |
| `command_log` | `command_id` (PK), `payload_sha256`, `received_at`, `origin`, `valid_until`, `result`, `result_payload`, `publication_seq` |
| `history_gap` | `gap_id`, `kind` (core_restart/db_outage/ha_disconnect/ingest_overflow/mqtt_disconnect), `started_at`, `ended_at`, `scope` |
| `diagnostic_event` | auffällige `unknown`/`unresolved`-Übergänge, Validierungs- und Laufzeitfehler |

Partitionierung und Aufbewahrung der History-Tabellen sind Alpha-Limit (Wachstum dokumentieren);
eine Löschung benötigter Historie ist ohne ausdrücklichen Beschluss verboten (M12-05).

### 12.3 Commit-before-publish

Der serialisierte Verarbeitungspfad (§14.4) bildet je Verarbeitungsschritt bzw. Mikro-Batch ein
**Changeset**: `contract_state_current/history`, `node_state`, `sm_*`, `deadline`,
`source_observation_*`, `command_log`-Ergebnis, `publication`-Zeile. Er schreibt es in **einer**
Transaktion. Erst nach erfolgreichem Commit:

1. wird der In-Memory-Publikationsstand aktualisiert,
2. werden Deltas an Subscriber gesendet,
3. werden Command-Acks beantwortet.

Schlägt der Commit fehl, wird **nichts** publiziert. „Publish jetzt, DB später“ ist verboten.

### 12.4 PostgreSQL-Ausfall

- Keine neue verbindliche Publication, kein erfolgreicher Write- oder Command-Ack.
- Die Domain-Quality des letzten persistierten Standes wird **nicht** umgeschrieben.
- Readiness meldet `persistence_unavailable`. Subscriber erhalten
  `service_state {publication_confirmed: false}`, der Client meldet „nicht bestätigt“ (M17-08).
- Die fachliche Fortschreibung (SM, Temporal, Deadlines) ist eingefroren. Ingest läuft technisch weiter
  und hält nur die **letzte Observation je Binding** mit Originalzeitstempeln (beschränkter Speicher).
  Zwischenereignisse werden nicht gepuffert, um später „erfunden“ zu werden.
- **Recovery** = logischer Restore: `history_gap(db_outage)` eintragen, persistierten Kontext neu laden
  (§9.4), mit aktuell zulässiger Evidence nach den Restore-Regeln auswerten, **neue Runtime-Epoche**.
  Keine Kontinuität über die Ausfallzeit, die nicht nach §9.3 belegbar ist.

### 12.5 Writer-Lock

- `pg_try_advisory_lock(<konstante Installations-Lock-ID>)` auf der dedizierten Writer-Verbindung.
- Gelingt der Lock nicht: keine Fortschreibung, Readiness `writer_lock_unavailable`, Retry mit Backoff.
- Lock- oder Verbindungsverlust: Fortschreibung sofort stoppen, Readiness meldet es,
  `runtime_epoch.ended_at` setzen (soweit möglich); Wiederaufnahme nur nach erneutem Lock mit
  **neuer Epoche** und logischem Restore (§12.4).

### 12.6 Migrationen

Explizite, nummerierte SQL-Migrationen (`migrations/NNNN_name.sql`) mit Checksumme. Sie laufen beim
Start **unter dem Writer-Lock**, vor Readiness. Ein kleiner eigener Runner genügt; Alembic ist nicht
nötig. Bekannte, aber veränderte Migration (Checksumme) → Start verweigert. **Unbekannt neueres
DB-Schema → Start verweigert** (`schema_newer_than_app`). Brechende Änderungen nur per
Expand/Contract über mindestens eine Version. Ein App-Update ändert nie automatisch fachliche Semantik
(Schemaversionen und Revisionen bleiben, M30-17).

## 13. Thin HA I/O Bridge

### 13.1 Zweck und Grund

Die reguläre HA-WebSocket-API liefert `state_reported` nicht (HA verlangt für dieses Event einen
Event-Filter; `subscribe_events` reicht keinen durch; `subscribe_entities` überträgt kein
`last_reported`). Die Bridge schließt genau diese Lücke. Die Runtime bleibt vollständig in der App.

### 13.2 Form

- HA-Custom-Integration, Domain **`core_contracts_bridge`**, Config-Flow mit einem Schritt, eine Instanz.
- Registriert ausschließlich HA-WebSocket-Kommandos (Admin-only). Die App ist Client über
  `ws://supervisor/core/websocket` mit `SUPERVISOR_TOKEN`. Die Bridge hat keine eigene
  Netzwerkverbindung, keine eigene Authentisierung und keine Kenntnis von App-Tokens.
- **Keine** Entities, Services, Timer, Speicher, Policy, Quality, Freshness, Grace, Fusion,
  Temporal-Logik, Contract-Ableitung, Normalisierung (z. B. `on` → `True`) oder Wahrheit.
  Keine Puffer, kein Verwerfen von Events.

### 13.3 Protokoll (`bridge_protocol = 1`)

**`core_contracts_bridge/info`** → `{bridge_version, protocol_version, ha_version, ha_state}`.

**`core_contracts_bridge/subscribe`** `{protocol_version: 1, entity_ids: [..]}` (Subscription):

1. **Erste Nachricht** `snapshot`: `{entities: {entity_id: State.as_dict() | null}, time_fired_at,
   ha_state}`. `null` = Entity **absent** (explizit, nicht weggelassen). `State.as_dict()` enthält
   `state`, `attributes`, `last_changed`, `last_updated`, `last_reported`, `context`.
2. Danach in Event-Bus-Reihenfolge:
   - `changed`: `{entity_id, old_state, new_state, time_fired, context}`; `new_state = null` = entfernt/absent.
   - `reported`: `{entity_id, last_reported, old_last_reported, time_fired, context_id}`.
3. Snapshot-Erzeugung und Listener-Registrierung erfolgen im **selben synchronen Callback ohne
   `await`** dazwischen, damit kein Race entsteht. `state_reported` wird mit Event-Filter auf die
   Entity-Menge abonniert, `state_changed` per entity-gebundenem Tracking.
4. Unsubscribe durch normales HA-Subscription-Ende. Eine Änderung der Entity-Menge erfolgt durch
   eine neue Subscription mit neuem Snapshot.

### 13.4 Verhalten in der App

- Beim Verbinden: `auth` → `info` (Protokollprüfung) → `get_config` (HA-Zustand für den
  Connectivity-Eintrag) → Lifecycle-Events über das Standard-`subscribe_events`
  (`homeassistant_start`, `homeassistant_started`, `homeassistant_stop`) → `core_contracts_bridge/subscribe`.
- Fehlt die Bridge oder ist sie inkompatibel: Readiness/Diagnose `bridge_missing` bzw.
  `bridge_incompatible`, HA-gebundene Sources werden `unknown` mit Reason `input_unavailable` und
  Detail. **Kein** stiller Rückfall auf `subscribe_entities` oder Polling.
- Snapshot-Zeilen gelten nur als neue Observation, wenn ihre HA-Zeitstempel neuer sind als die
  bekannte Observation (§8.2). Restaurierte HA-Entities (`attributes.restored = true`) werden als
  `ha_restored` markiert und sind nicht frisch.
- Ein HA-Neustart bei laufender App ist ein **Reconnect** mit `history_gap(ha_disconnect)`, kein
  Core-Restore. Der Connectivity-Eintrag HA folgt `ready/starting/unavailable`.
- Reconnect mit exponentiellem Backoff (Obergrenze konfigurierbar).
- Die Bridge-Version wird in der Admin-UI und in Diagnostics angezeigt.

### 13.5 Weitere HA-I/O der App (ohne Bridge)

- Presence-Reconciliation darf je Source konfigurierte Aktualisierungsaufrufe
  (`homeassistant.update_entity` o. ä.) über `call_service` auslösen. Anzahl, Abstände und Dauer
  sind Parameter (P4-62 §7). Der Trigger selbst ist nie Evidence.
- Die App ruft sonst **keine** HA-Services auf (kein Apply).

## 14. Supervisor-App

### 14.1 Repository-Layout (Ziel; im bestehenden Repo `Levtos/core-contracts`)

```text
repository.yaml                       # HA-App-Repository-Metadaten
core_contracts/                       # App-Verzeichnis (Supervisor)
  config.yaml, Dockerfile, rootfs/ (entrypoint), translations/, DOCS.md, CHANGELOG.md
src/core_contracts/                   # Python-Runtime (Paket)
client/core_contracts_client/         # CoreContractsClient (eigenständiges Paket)
custom_components/core_contracts_bridge/   # Thin HA I/O Bridge (HACS-fähig)
frontend/                             # Alpha-1-Admin-UI
migrations/                           # SQL-Migrationen
tests/                                # unit / scenario / integration / e2e
docs/alpha1/                          # Build-Spezifikation (Kopie), Betriebsdoku
dev/                                  # docker compose (nur Dev/Test), Fake-HA
```

Die Legacy-Integration `custom_components/benni_core_contracts/` wird **nicht** weitergeführt (§23.3).

### 14.2 `config.yaml` (Festlegung)

```yaml
name: Core Contracts
slug: core_contracts
version: <App-Version>
arch: [amd64, aarch64]
startup: services        # vor HA Core; HA-Consumer finden die App beim Start
boot: auto
init: true               # tini als PID 1, SIGTERM-Weiterleitung
homeassistant_api: true
hassio_api: false
ingress: true
ingress_port: 8099       # Admin-UI + Admin-API (nur über Ingress)
panel_icon: mdi:file-certificate-outline
panel_admin: true
ports:
  8787/tcp: null         # Consumer-API, nur internes Netz, kein Host-Mapping
watchdog: "http://[HOST]:[PORT:8787]/health/live"
timeout: 30
backup: hot
services: ["mqtt:want"]
map: ["ssl:ro"]          # optional für PG-CA-Zertifikat
options/schema: postgres_host, postgres_port, postgres_database, postgres_user,
  postgres_password (password), postgres_sslmode, postgres_ca_file?,
  installation_label?, initialize_empty_database (bool, default false),
  adopt_installation_id (str?), mqtt_mode (supervisor|external|disabled),
  mqtt_host?, mqtt_port?, mqtt_user?, mqtt_password (password)?, log_level, log_format (text|json)
image: ghcr.io/levtos/{arch}-core-contracts
```

Kein `privileged`, kein `docker_api`, kein `host_network`, keine zusätzlichen Capabilities,
AppArmor-Standard.

### 14.3 Container

- Explizites `FROM` (glibc-basiertes Python-3.14-Image empfohlen, z. B. `python:3.14-slim`).
  Kein `BUILD_FROM`-Fallback, kein `build.yaml`.
- Multi-Stage: Builder (`uv sync --frozen --no-dev`, Frontend-Build) → Runtime-Image ohne Build-Tools.
- Keine Dependency-Auflösung beim Start.
- Entrypoint läuft kurz als root: legt `/data/` an und setzt Rechte nur für eigene Pfade
  (`/data/installation.json`, `/data/secrets/`), dann `exec setpriv --reuid=cc --regid=cc
  --init-groups --inh-caps=-all python -m core_contracts`. Der Python-Prozess läuft **dauerhaft non-root**.
- `HEALTHCHECK` (falls gesetzt) nutzt ausschließlich `/health/live`.

### 14.4 Prozessmodell

Ein Prozess, `asyncio`. Beaufsichtigte Tasks:

| Task | Aufgabe |
|---|---|
| `ha_adapter` | HA-WS-Verbindung, Bridge-Subscription → `ingest_queue` |
| `mqtt_adapter` | aiomqtt → `ingest_queue` |
| `scheduler` | fällige Deadlines/Zeitereignisse → `ingest_queue` |
| `api` | aiohttp (Consumer-Listener 8787, Ingress-Listener 8099); Commands → `ingest_queue` |
| **`processor`** | **einziger** serialisierter autoritativer Pfad: Event → Auswertung → Changeset → Commit → Publish |
| `health` | Event-Loop-Heartbeat |

Netzwerk-Callbacks verändern nie Domain-State. Queues sind begrenzt (Größen konfigurierbar).
Überlauf der `ingest_queue` wird sichtbar (`history_gap(ingest_overflow)`, Diagnose), die betroffene
Adapter-Subscription wird kontrolliert neu aufgebaut (Snapshot), die Unsicherheit wird über die
Freshness- und Kontinuitätsregeln sichtbar. Es gibt kein stilles Verwerfen. Mikro-Batching im Processor
ist zulässig (mehrere Events → eine Publication), solange die Reihenfolge erhalten bleibt.
Ein abgestürzter Task wird geloggt. Der Supervisor-Task startet Adapter neu. Ein Absturz des Processors
macht `/health/live` rot.

### 14.5 Startup und Shutdown

**Startup:**
1. Config laden.
2. `installation.json` lesen.
3. DB verbinden.
4. Writer-Lock holen.
5. Migrationen ausführen.
6. `installation_id` prüfen (§11.2).
7. Neue Epoche anlegen.
8. Aktive Registry laden.
9. Restore (§9.4).
10. Adapter starten.
11. Erste HA-Snapshot-Runde abwarten (mit Timeout).
12. Ready.

**Shutdown (SIGTERM):**
1. Ingest stoppen.
2. Laufenden Changeset committen oder verwerfen (nie halb).
3. Subscriber mit `going_away` schließen.
4. Epoche beenden.
5. Lock freigeben.
6. Verbindungen schließen.

Das Ganze innerhalb von `timeout`.

## 15. Consumer API

### 15.1 Listener und Grundsätze

- Ein `aiohttp`-Server, zwei Listener:
  - **Consumer-Listener** `:8787`: internes Netz, Bearer-Token.
  - **Ingress-Listener** `:8099`: nur Anfragen von der Supervisor-Ingress-Adresse, HA-Benutzeridentität
    aus Ingress-Headern, Panel admin-only.
- Kein zweites Webframework. Kein direkter DB-Zugriff für Consumer. Keine Cross-Imports.
- Die API ist **UI-neutral**: Die Admin-UI nutzt dieselben öffentlichen Endpunkte.
- JSON, Zeitstempel RFC 3339 in UTC.

### 15.2 Endpunkte (Pfadfestlegung `api_protocol = 1`)

| Methode | Pfad | Zweck | Auth |
|---|---|---|---|
| GET | `/health/live` | Liveness | keine |
| GET | `/health/ready` | Readiness + Komponenten (ohne Secrets) | keine |
| GET | `/api/v1/info` | `installation_id`, `installation_label`, Versionen (§25.3), `epoch_id` | consumer |
| GET | `/api/v1/schemas` | Schema-/Value-Catalog | consumer |
| GET | `/api/v1/contracts` | Liste mit `enabled`, Schema, Status-Kurzform | consumer |
| GET | `/api/v1/contracts/{contract_id}` | aktueller Envelope | consumer |
| GET | `/api/v1/snapshot?contracts=a,b` | konsistenter Snapshot `{epoch_id, publication_seq, registry_revision, contracts}` | consumer |
| GET | `/api/v1/ws` | WebSocket (§15.4) | consumer |
| POST | `/api/v1/commands` | Command (§16) | consumer |
| GET | `/api/v1/commands/{command_id}` | Ergebnisabfrage (verlorene Antwort) | consumer |
| GET | `/api/v1/diagnostics` | Runtime, Queues, DB, Lock, HA/Bridge, MQTT, Connectivity, Gaps | admin |
| GET | `/api/v1/diagnostics/problems` | aktuelle `unknown`/`unresolved` mit Reasons | consumer |
| GET | `/api/v1/history/{contract_id}?from&to` | Verlauf (paginiert) | admin |
| GET | `/api/v1/registry/active` | aktive Revision | admin |
| GET | `/api/v1/registry/revisions[/{n}]` | Revisionen | admin |
| GET | `/api/v1/registry/active/export` | Export ohne Runtime/Secrets | admin |
| POST | `/api/v1/registry/drafts` | Draft aus aktiver Revision oder Import | admin |
| GET/PUT | `/api/v1/registry/drafts/{id}` | Draft lesen/schreiben (`expected_draft_version`) | admin |
| POST | `/api/v1/registry/drafts/{id}/validate` | Validierung + Trockenlauf-Diff | admin |
| POST | `/api/v1/registry/drafts/{id}/activate` | Aktivierung (`expected_active_revision`) | admin |
| POST | `/api/v1/registry/rollback` | `{target_revision, expected_active_revision}` → neue Revision | admin |

Fehler sind strukturiert: `{error: {code, message, detail}}`, z. B. `contract_disabled`,
`contract_not_found`, `revision_conflict`, `not_ready`, `persistence_unavailable`.

### 15.3 Contract-Envelope (Wire-Format)

```json
{
  "contract_id": "opening.living_room_window_left",
  "schema": {"id": "opening", "version": 2},
  "enabled": true,
  "contract_health": "healthy",
  "fields": {
    "state": {
      "status": "valid",
      "value": "closed",
      "quality": "healthy",
      "held_until": null,
      "since_at": "2026-10-07T18:00:00Z",
      "freshness": {"state": "fresh", "basis": "report_heartbeat", "observed_at": "…"},
      "reasons": [],
      "evidence": [{"binding_id": "…", "source_id": "…", "value_raw": "off",
                    "device_time": null, "ha_last_changed": "…", "ha_last_reported": "…",
                    "received_at": "…", "observation_kind": "report"}]
    }
  },
  "available": true,
  "computed_at": "…", "published_at": "…",
  "publication_seq": 18427, "registry_revision": 12, "epoch_id": "…"
}
```

Episoden, Deadlines und Sessions erscheinen bei SM-Contracts in einem zusätzlichen Block `state_machine`
(`state`, `since_at`, `episode_id`, `deadlines`, `origin`).

### 15.4 WebSocket-Protokoll

1. Client → `hello {protocol_version: 1, expected_installation_id?, client_name}`;
   Server → `welcome {installation_id, epoch_id, versions}` oder Fehler `installation_mismatch`.
2. Client → `subscribe {id, contracts: [..]}` → Server sendet **atomar** `snapshot {id, epoch_id,
   publication_seq, contracts}`. Der Snapshot und der Beginn der Delta-Zustellung werden im
   Processor-Kontext ohne Lücke gekoppelt.
3. Server → `delta {id, epoch_id, publication_seq, prev_seq, contracts: {…}}`. `prev_seq` ist die
   zuletzt **an diese Subscription** gesendete `publication_seq`. Der Client erkennt Lücken lokal.
4. Server → `service_state {ready, publication_confirmed, persistence, ha, bridge, mqtt}` bei jeder
   Änderung.
5. Server → `resync_required {id, reason}` bei Sequenzlücke, neuer Epoche oder Überlauf der
   Subscription-Queue (Größe konfigurierbar). Danach liefert ein erneuter `subscribe` einen
   vollständigen Snapshot. **Kein Event-Replay.**
6. `ping`/`pong` (Intervall konfigurierbar). Beim Shutdown sendet der Server `going_away`.

### 15.5 Revisionsmodell

- `registry_revision`: aktive Konfigurationsrevision.
- `publication_seq`: monotone Publication-Nummer je Installation, persistent, epochenübergreifend.
- `epoch_id`: Runtime-Epoche. Bei Epochenwechsel wird jeder Subscriber zum Resync gezwungen.
- Ein Snapshot gehört immer zu genau einer `publication_seq`. Mischstände gibt es nicht (CP-08/F-23).

### 15.6 `CoreContractsClient`

Eigenständiges Python-Paket `core_contracts_client`. Abhängigkeiten nur `aiohttp` und `pydantic`.
Keine Abhängigkeit zur Runtime. Funktionen:

- `CoreContractsClient(base_url, token, expected_installation_id, *, session=None)`. Alle Parameter
  sind explizit; es gibt keine Default-Installation.
- `info()`, `snapshot(contracts)`, `contract(contract_id)`.
- `subscribe(contracts)` → asynchroner Iterator über `Snapshot`/`Delta`. Lücken, Epochenwechsel und
  `resync_required` werden intern per Resync behandelt; nach außen wird ein konsistenter neuer
  Snapshot geliefert.
- `connection_state` ∈ `connected, reconnecting, disconnected` und `publication_confirmed` (bool).
  Der Client verändert **nie** Status oder Quality eines Contracts.
- `command(...)` erzeugt `command_id` (UUIDv4). Bei Netzfehler wird **mit derselben ID** wiederholt bzw.
  das Ergebnis über `GET /commands/{id}` abgefragt.
- Typisierte Modelle (Pydantic v2) für Envelope, Snapshot, Delta, Command, Fehler.

Alte Zugriffswege (`hass.data["…"]["_consumer_api"]`, Cross-Imports von `ProfileId`/`ConsumerRequirement`)
sind abgeschafft (M17-03).

## 16. Commands

- Commands sind **pro State Machine** definiert. Es gibt **kein** `set_state`, keine freie Mutation von
  Contract-Werten und kein generisches Override (M30-25, M13-01).
- Envelope:
  `{command_id (UUID), contract_id, command, args, origin {kind: consumer|admin_ui, actor, client_name},
  issued_at, valid_until, expected_registry_revision?}`. Die Installation ergibt sich aus der Verbindung.
- `valid_until` ist Pflicht. Ein abgelaufenes Command wird abgelehnt (`expired`).
- Ablauf: Validierung → `ingest_queue` → Processor prüft Guards → Ergebnis
  `accepted | rejected(reason) | expired | not_supported`. Das Ergebnis wird im selben Commit wie die
  Wirkung persistiert, erst danach folgt die Antwort.
- **Idempotenz:** gleiche `command_id` + gleicher Payload-Hash → gespeichertes Ergebnis, keine erneute
  Wirkung. Gleiche ID mit anderem Inhalt → `command_id_conflict`.
- Commands werden nach Restore nie wiederholt. Core löst keine externen Aktionen aus.
- **Alpha-1-Commands:**
  - `bio.<subject>`: `confirm_sleep` (Herkunft `manual_confirmation`; Guard: kein harter Blocker,
    sonst `rejected` mit Reason, z. B. `pc_active`; erneute Bestätigung startet volle 45 min, M30-19).
  - `wake.plan`: `set_exception {date, local_time}`, `clear_exception {date}`.
  - Stufe B: `privacy_context`: `start_date_time`, `stop_date_time`.
- Physische Taster (z. B. Sleep-Taste am Bett) sind **manuelle Sources** mit `origin = manual`,
  gebunden an die SM (M30-25, M11-18), keine API-Commands.

## 17. MQTT

- `aiomqtt`. Modi `supervisor` (Zugangsdaten zur Laufzeit über die Supervisor-Services-API, nicht
  gespeichert), `external` (Zugangsdaten aus App-Optionen) und `disabled`.
- MQTT dient **nur** konfigurierten nativen Quellen und technischen Funktionen
  (Connectivity-Heartbeats, z. B. Z2M-Bridge-State). Es ist **kein** Contract-Bus: keine Projektion
  von Contracts, keine Core-Commands über MQTT.
- Retained-Nachrichten werden mit `mqtt_retained = true` markiert, sind nie frisch und nie positive
  Evidence (M14-02).
- QoS-Duplikate werden über (Topic, Payload-Hash, Quellzeit) dedupliziert.
- Birth/Will und Broker-Status sind Connectivity-Informationen, keine fachliche Evidence.
- Für dieselbe physische Beobachtung gibt es nie MQTT **und** HA als unabhängige Evidence (§8.4).

## 18. Zeitmodell

- Intern ausschließlich timezone-aware UTC (`datetime` mit `UTC`). Persistenz als `timestamptz`,
  Wire-Format RFC 3339 UTC (`Z`).
- Laufende Dauern im Prozess über die monotone Clock. **Monotone Rohwerte werden nie persistiert oder
  restauriert.**
- Persistente Fristen als absolute UTC-Zeitpunkte. Nach Restart und bei erkanntem Wall-Clock-Sprung
  werden Timer aus den UTC-Fristen neu geplant.
- Wall-Clock-Sprungerkennung: Abweichung Wall-Δ gegenüber Monotonic-Δ über einer konfigurierbaren
  Schwelle → Diagnose-Ereignis und Neuplanung. Ein Rückwärtssprung erzeugt keine „verstrichene“
  negative Dauer und keine Doppelauslösung bereits verarbeiteter Deadlines (Status `fired`).
- Lokale Kalenderlogik (Tagesphase, Wake-Plan, Wochenende/Feiertag) in `Europe/Berlin` über `zoneinfo`.
  `tzdata` ist als Abhängigkeit gepinnt.
- **DST-Konvention (technisch):** Wo portierter Code (day_phase, wake.plan) DST nicht selbst regelt,
  gilt: nicht existente lokale Zeit → erste gültige Zeit nach der Lücke; mehrdeutige lokale Zeit →
  erstes Auftreten (`fold=0`). Dies ist dokumentiert und getestet.
  **Review-Punkt:** Wirkt die Konvention fachlich auf einen Contract, wird das als Produktfrage gemeldet
  und nicht als Semantik festgeschrieben.
- **Clock-Abstraktion** (einziger Zugang zur Zeit): `now_utc()`, `monotonic()`, `call_at_utc()`,
  `call_later()`, `sleep()`. Direkte Aufrufe von `datetime.now`, `time.time` oder
  `loop.call_later` außerhalb der Clock sind per Ruff-Regel (`DTZ`, banned-api) verboten.
- **FakeClock** für Tests: steuerbares `now_utc`, steuerbares `monotonic`, deterministisches
  Scheduling (`advance(dt)`), Sprungsimulation vorwärts und rückwärts.

## 19. Security

- Nur `homeassistant_api: true`. `hassio_api: false`, kein Privileged-Modus, kein Docker-Socket,
  kein Host-Netzwerk, kein Host-Port-Mapping.
- **Tokens je Installation** (zufällig, ≥ 256 Bit, beim Erststart erzeugt, `/data/secrets/`, Rechte 0600):
  - `consumer_token` (Reads, Subscriptions, Commands),
  - `admin_token` (Registry-/Admin-Endpunkte außerhalb von Ingress, z. B. Skripte).
  - Rotation per Admin-Endpunkt bzw. -UI. Die Anzeige eines Tokens ist nur im Ingress-Panel möglich
    (Admin) und wird protokolliert (ohne Token).
- Ingress-Listener akzeptiert nur die Supervisor-Ingress-Quelladresse und wertet die
  Ingress-Benutzer-Header aus. Panel admin-only.
- Consumer-Listener vergleicht Tokens zeitkonstant und begrenzt Fehlversuche (Rate-Limit).
- Die Bridge hat nur Admin-WS-Kommandos.
- Non-root-Prozess, minimale Rechte auf `/data`.
- **Keine Secrets** in Registry, Git, Image, URLs, Query-Strings oder Logs. Log-Redaction für bekannte
  Secret-Felder. Die Registry-Validierung weist geheimnisverdächtige Schlüssel ab.

## 20. Konfiguration und Secrets

| Wert | Quelle | Persistenz |
|---|---|---|
| `SUPERVISOR_TOKEN` | Umgebung | nie |
| PostgreSQL-Zugang | App-Option (`password`-Typ) | `/data/options.json` (Supervisor) → im HA-Backup (verschlüsselbar) |
| PG-CA-Zertifikat | `/ssl` (read-only Map) | extern |
| MQTT (Supervisor) | Services API zur Laufzeit | nie |
| MQTT (extern) | App-Option (`password`-Typ) | `/data/options.json` |
| `installation_id` | `/data/installation.json` + `cc_meta` | beides |
| API-Tokens | `/data/secrets/*` | `/data` |

Docker-/Compose-Secrets werden im Produktivbetrieb nicht verwendet (der Supervisor unterstützt sie
nicht). Compose-Secrets oder `.env` sind nur im Dev-Setup zulässig und nie eingecheckt.

## 21. Health und Readiness

| Endpunkt | Prüft | Nutzer |
|---|---|---|
| `/health/live` | Event-Loop-Heartbeat (< 5 s alt), Processor-Task lebt (darf warten), Lifecycle nicht im Fehlzustand | **Supervisor-Watchdog und Container-Healthcheck ausschließlich** |
| `/health/ready` | Migrationen ok, DB erreichbar, Writer-Lock gehalten, `installation_id` geprüft, aktive Registry geladen, erste HA-Bridge-Snapshot-Runde in dieser Epoche abgeschlossen | Diagnose, Client, Admin-UI |

- Readiness liefert Komponenten (`db`, `writer_lock`, `migrations`, `registry`, `ha`, `bridge`, `mqtt`)
  mit Zustand und Reason.
- Ein späterer HA-Verbindungsverlust macht Readiness **nicht** rot. Er erscheint als Komponente
  `ha: unavailable` und semantisch über Connectivity und Freshness.
- Ein DB-Ausfall oder Lock-Verlust macht Readiness rot (`publication_confirmed = false`), Liveness
  bleibt grün.
- Ausfälle externer Abhängigkeiten DÜRFEN NICHT über den Watchdog zu einem künstlichen Core-Restart
  führen.

## 22. Logging und Diagnostics

- Strukturierte Logs auf stdout, Format `text` (key=value, Default) oder `json`; Felder `ts`, `level`,
  `component`, `event`, `installation_id` (beim Start), `epoch_id`, Kontext.
- Pflicht-Log-Ereignisse: Start/Stop, Epochenwechsel, Migrationen, Registry-Aktivierung/-Rollback,
  Lock-Erwerb/-Verlust, DB-Ausfall/-Recovery, HA-/Bridge-/MQTT-Verbindungswechsel, Queue-Überlauf,
  History-Gaps, jeder Übergang eines Contract-Felds **nach** `unknown`/`unresolved` (mit Reason) und
  zurück, abgelehnte Commands.
- `/api/v1/diagnostics`: Versionen, `installation_id`, Epoche, Queue-Füllstände, letzte Commit-Dauer,
  `publication_seq`, Readiness-Komponenten, Bridge-Version/-Protokoll, Subscriptions, aktuelle Gaps,
  Connectivity-Einträge.
- Keine Secrets, keine vollständigen Payloads mit potentiell personenbezogenen Rohdaten auf `info`-Level.

## 23. Migration und Upgrade

### 23.1 App-Updates
Migrationen gemäß §12.6. Ein App-Update aktiviert nie automatisch eine neue Registry-Revision und
migriert keine Contract-Schemaversionen.

### 23.2 Übernahme der bestehenden V1 (Legacy)
- Alpha 1 ist ein **Zielbau**; ein In-Place-Upgrade der Legacy-Integration ist nicht gefordert.
- Alpha 1 nutzt eine **neue** Datenbank je Installation. Die Legacy-DB wird nicht verändert.
- Optionales Werkzeug `core-contracts import-legacy` (SOLL): liest eine Legacy-Registry-Revision (JSONB
  v1/v2) **read-only**, entfernt `profile_id`/`profile`/`consumer_ids`, übersetzt Sources/Bindings, soweit
  eindeutig, und erzeugt einen **Draft** mit Bericht über nicht übersetzbare Teile. Keine Aktivierung.
- Legacy-Migration darf den Build nicht dominieren: nicht Übersetzbares wird berichtet, nicht
  nachgebaut.

### 23.3 Legacy-Integration `benni_core_contracts`
- Wird im Alpha-1-Stand des Repos als Legacy entfernt bzw. archiviert (Profil-, Shadow-, Published-,
  Gate-Logik). Ihre Tests werden nur übernommen, wenn sie Zielsemantik prüfen.
- **Live-Hinweis:** `blind_control` konsumiert heute live die Legacy-ConsumerApi. Das Umstellen auf
  `CoreContractsClient` ist ein eigener, von Benni freizugebender Schritt. Alpha 1 erzeugt **kein**
  Release bzw. keinen Tag, der den Legacy-HACS-Pfad live ersetzt, ohne Bennis Freigabe.

## 24. Backup und Restore

- **Supervisor-Backup** (`backup: hot`) sichert `/data` (Bootstrap, Tokens, Optionen). Es enthält
  **nicht** die externe PostgreSQL-DB.
- **PostgreSQL-Backup** separat und konsistent (z. B. `pg_dump -Fc` oder PITR) mit eigener Aufbewahrung.
  Das Runbook liegt in `docs/alpha1/operations.md`.
- Ein **vollständiger Restore** braucht eine passende App-Version, App-Daten, das PG-Backup,
  Credentials/Secrets und Versionsmetadaten (`cc_meta`, Migrationsstand).
- Ein Supervisor-Restore überschreibt **nie** automatisch die externe DB. Die App prüft beim Start
  Identität und Schema (§11.2, §12.6).
- Ein PG-Restore ist ein **echter Core-Restore (CP-15)**: neue Epoche, Restore-Regeln, `history_gap`.
- SOLL: Die App merkt sich die zuletzt bestätigte `publication_seq` beim geordneten Shutdown in
  `/data`. Liegt die DB beim Start darunter, gibt es die Diagnose `database_older_than_last_shutdown`
  (Hinweis auf PG-Restore), und Restore-Regeln gelten.

## 25. Dependency- und Build-Baseline

### 25.1 Laufzeit
CPython **3.14.x** (regulärer GIL-Build, kein Free-Threading), `asyncio`, vollständig typisiert.
Abhängigkeiten (Lockfile entscheidet konkrete Versionen): `aiohttp`, `asyncpg` (0.32.x), `pydantic` v2,
`aiomqtt`, `tzdata`. Für Feiertage gilt dieselbe Bibliothek bzw. Logik, die der 1:1-Port aus
`benni-core-state` verwendet.

### 25.2 Werkzeuge
`pyproject.toml`, `uv`, eingechecktes `uv.lock`, Ruff (inkl. `DTZ`, banned-api für Zeitzugriffe),
mypy `--strict` für `src/` und `client/`, pytest + pytest-asyncio. Frontend: bestehender
Vite/TypeScript-Toolchain, falls wiederverwendbar (§26). CI: Lint, Typen, Tests, Frontend-Build,
Image-Build amd64/aarch64.

### 25.3 Versionierung (getrennt, nie voneinander abgeleitet)

| Version | Alpha-1-Startwert |
|---|---|
| App-Version | `1.0.0a1` (PEP 440), `1.0.0-alpha.1` in `config.yaml` |
| API-Protokoll | `1` |
| Contract-Schemas | je Schema (z. B. `opening` 2, `presence` 2, `bio` 2, `activity` 2) |
| Konfigurationsschema | `3` |
| DB-Schema | Migrationsnummer |
| Bridge-Protokoll | `1` (Bridge-Version separat) |
| Client-Paket | eigene SemVer, kompatibel zu API-Protokoll 1 |

## 26. Alpha-1-Admin-UI

- Zweck: funktionale Engineering- und Admin-Oberfläche über Supervisor Ingress. **Keine** verbindliche
  spätere UX-Architektur.
- Muss anzeigen: Runtime-Status, Liveness/Readiness mit Komponenten, HA-/Bridge-Verbindung
  (inkl. Bridge-Version), PostgreSQL, Writer-Lock, Epoche, aktive Registry-Revision, Contract-Liste mit
  `enabled`, aktuellem Wert, Status, Quality, Freshness, Reasons, Evidence, Connectivity, Diagnostics,
  Probleme (`unknown`/`unresolved`), History-Gaps.
- Administration: Registry/Drafts als JSON-Editor mit Validierung, Diff, Aktivierung, Rollback,
  Export/Import (nur Draft); Token-Anzeige und -Rotation (Admin).
- Kein visueller Regel- oder SM-Editor, kein Drag-and-Drop, keine Umbrella-Policy-UX.
- Die UI nutzt ausschließlich die öffentliche API (§15). UX-Layout-State ist kein Registry- oder
  Contract-State und wird höchstens lokal im Browser gehalten.
- Wiederverwendung: Der bestehende Svelte-5/Vite/TypeScript-Code wird geprüft. Er wird weiterverwendet,
  wenn er sauber, aktuell und architekturkonform ist (kein HA-WS-Transport, keine Profile, kein Shadow).
  Sonst wird er minimal ersetzt. Keine große UX-Neuentwicklung.

## 27. Tests

Testarten: `unit` (rein, FakeClock), `scenario` (Fachakte-Fälle als ausführbare Szenarien),
`integration` (echtes PostgreSQL via Compose/Container), `bridge` (Fake-HA-WS-Server; zusätzlich ein
echter HA-Dev-Container, soweit verfügbar), `e2e` (App-Container + PG + Fake-HA), `supervisor-smoke`
(soweit eine Supervisor-Umgebung verfügbar ist).

Pflichtfälle (Auszug, vollständig umzusetzen):

- **Unit:** Fusion (`first_healthy`, `latest` nach Messzeit, `any_true`/`all_true` dreiwertig,
  `opening_contacts` asymmetrisch), Quality-Aggregation (Pflichtfelder), Freshness je Modus inkl. harte
  Gates, Reasons, Grace/Held inkl. frühestem Grace-Ende und keiner Kettenverlängerung, `unknown` ≠
  `false`, Konflikt → `unknown`+`conflict`, strenge Auswahl → `unresolved`, `bucket` mit Hysterese und
  Pflicht-`initial`, `map` → `unmapped_value`, Temporal `stable_for` mit Lücke (Beispiel M30-14:
  12:00:00 wahr, 12:00:05 unknown, 12:00:08 wahr → erfüllt frühestens 12:00:18).
- **Szenarien aus der Fachakte:** A-01 (TV-off in Pre-Sleep → `sleep`, Herkunft `inferred_tv_off`, keine
  neue Frist), A-02 (Timeout 23:45 → `sleep`, keine neue Deadline), A-04-Beispiel (`tv.source` held bis
  12:00:05 → Activity höchstens bis 12:00:05 held), A-06-Beispiel (Revision 15 W/10 W → 15 W/20 W: keine
  fallende Flanke), A-09 (ATV + TV an + idle → `streaming`), P4-55 (`other` + `activity_mapping_missing`),
  P4-58 (TV/PC zuletzt aktiviert gewinnt, Rückfall), P4-60 (Flur-Reset nur bei Flanke, Terrassentür weckt
  aus `sleep`, Toilette nicht, `unknown` TV/PC hält Deadline, `away_confirmed` → `awake`, Waking max.
  60 min), P4-56 (Presence 6 min `held` → `unknown`; frische Evidence beendet `held`), P4-57
  (Zwischenzone hält), P4-62 (Etagentür-Trigger setzt nie `home`), P4-65 (frisches `open` sofort;
  Konflikt sofort `unknown`; einzelnes `closed` → Grace → `unknown`; Heartbeat hält geschlossenes Fenster
  frisch), P4-64 (`parents` → Simulation `inactive`), M30-19 (`confirm_sleep` mit PC aktiv → `rejected`).
- **Restore:** Neustart während Grace (Restzeit, keine neue Grace), überfällige Deadline, stale
  Evidence, fehlende Ereignisse (nicht rekonstruiert), rekonstruierbares bzw. nicht rekonstruierbares
  `since_at` (§9.3), SM-Gedächtnis, Flanken-Baseline mit gleichem bzw. anderem Fingerprint, Latch startet
  bei `initial`, Startfälle §9.4 (fehlender Kontext ≠ Erststart).
- **PostgreSQL:** Commit/Rollback, Commit-before-publish (Fehlerinjektion vor Commit → keine
  Publication), DB-Ausfall/Recovery (neue Epoche, Gap), Writer-Lock (zweite Instanz bekommt keinen
  Lock), Lock-Verlust, Migration vorwärts, verändertes bzw. neueres Schema → Ablehnung, falsche
  `installation_id` und alle Fälle aus §11.2, Crash vor/nach Commit (Kill-Test), Restore aus `pg_dump`.
- **HA-Bridge:** Snapshot inkl. absent, `state_changed`, `state_reported`, Reihenfolge,
  HA-Restart (restored-Entities nicht frisch), Bridge-Reload, Reconnect, Verbindungslücke → Gap,
  Snapshot-Zeile ohne neue Zeitstempel ist keine neue Observation, fehlende bzw. inkompatible Bridge →
  sichtbare Diagnose ohne Fallback.
- **Consumer:** Snapshot, Deltas, Sequenzlücke, neue Epoche, langsamer Subscriber → `resync_required`,
  Resync, verlorene Command-Antwort (Abfrage per ID), doppelte `command_id` (gleich/abweichend),
  `expected_installation_id` falsch → Ablehnung, `publication_confirmed=false` bei DB-Ausfall,
  `contract_disabled`.
- **MQTT:** Retain nie frisch, QoS-Duplikate, alte Zeitstempel, Heartbeats, Doppelpfad HA+MQTT → Validierung
  lehnt ab.
- **Zeit:** FakeClock, Vorwärts- und Rückwärtssprung (keine Doppelauslösung), DST-Lücke und
  DST-Doppelstunde in `Europe/Berlin`.
- **Registry:** Draft ≠ ausgewertet, Aktivierung atomar, OCC-Konflikt, Rollback = neue Revision,
  Import erzeugt nur Draft, `profile`/`consumer_ids` im Import → abgewiesen, Single-Producer-Verletzung →
  abgewiesen, Zyklus → abgewiesen, fehlender Pflicht-Parameter → `config_incomplete`, `enabled=false` →
  nicht ausgewertet; `enabled=true` → sofort live (CP-17c-Sofortauswertung).
- **Supervisor/Container:** Installation, Start, Restart, SIGTERM-Shutdown, Watchdog nur Liveness
  (DB-Ausfall erzeugt keinen Restart), Non-root, Rechte auf `/data`, Backup/Restore-Smoke.

## 28. Akzeptanzkriterien Alpha 1

Alpha 1 ist funktional erfolgreich, wenn nachgewiesen (Test oder dokumentierter Smoke-Test):

1. Die Supervisor-App ist installierbar (lokales App-Repository) und startet non-root.
2. Die Thin HA Bridge ist installierbar, meldet `info` und ist protokollkompatibel.
3. PostgreSQL ist verbunden, Migrationen laufen, und der Writer-Lock wirkt.
4. `installation_id` wird erzeugt und geprüft. Alle Ablehnungsfälle aus §11.2 funktionieren.
5. Eine aktive Registry kann über Draft → Validierung → Aktivierung geladen werden. Rollback funktioniert.
6. Sources und Bindings (HA inkl. `state_reported`, MQTT, Scheduler) liefern Observations.
7. Die Stufe-A-Contracts (§6.8) werden ausgewertet.
8. Quality, Freshness, Evidence und Reasons werden korrekt erzeugt (Testsuite §27).
9. State Machines (Presence, Bio) und Temporal-Operatoren funktionieren.
10. Zustand, Historie, Episoden und Deadlines sind persistent. Commit-before-publish ist nachgewiesen.
11. Restart/Restore folgt §9 (Testsuite).
12. Contracts sind über `CoreContractsClient` und API konsumierbar (Snapshot + Subscription + Resync).
13. Die Commands aus §16 funktionieren idempotent.
14. Die Diagnose ist verständlich (Admin-UI + Diagnostics-API).
15. Ein Contract mit `enabled=true` ist unmittelbar nach Aktivierung live.
16. Ein Contract mit `enabled=false` wird nicht ausgewertet und nicht publiziert.
17. Es gibt keinen Shadow-Modus und keinen Profil-Rest in Code, API, Schema oder UI.
18. Die wichtigsten Invarianten der Fachakte sind automatisiert getestet (§27).

Technisch fertig ist nicht Live. **Live und Live Verified bleiben Bennis Gate.**

## 29. Build-Time Verification

Diese Punkte sind beim Build **empirisch** zu prüfen. Sie öffnen keine Architekturfrage. Scheitert ein
Punkt, ist zuerst eine technische Korrektur innerhalb dieser Spezifikation zu suchen. Neue Fachsemantik
darf dabei nicht erfunden werden.

- Python-3.14-Kompatibilität aller Dependencies; `asyncpg` 0.32.x; `aiomqtt` unter 3.14; Wheels für
  amd64 und aarch64 (kein Quellbau unter QEMU).
- Supervisor-Build mit explizitem `FROM`; Multi-Arch-Image; lokales App-Repository; `repository.yaml`
  und HACS-Struktur im selben Repo.
- Ob der Supervisor-Token-User Admin-WS-Kommandos der Bridge aufrufen darf.
- `state_reported`-Event-Filter-Registrierung in der Bridge; Last bei hochfrequenten Sensoren;
  HA-Sendepufferlimit bei Last (Verbindungsabbruch → Resync).
- Snapshot-/Subscription-Verhalten über HA-Restart und Bridge-Reload.
- MQTT über die Services-API (`mqtt:want`).
- Non-root-Rechte auf `/data`; Entrypoint-Rechteabgabe; SIGTERM-Weiterleitung über `init: true`.
- Ingress-Quelladresse und Benutzer-Header.
- Internes App-Hostname-Schema für HA-Consumer (`<repo-präfix>-core-contracts`).
- DB-Ausfall-Verhalten, Writer-Lock, Backup/Restore-Smoke.
- Frontend-Toolchain-Wiederverwendbarkeit.
- Supervisor-Discovery: in Alpha 1 nicht erforderlich (die Bridge braucht keine App-Tokens). KANN
  optional für eine Bridge-Einrichtungsaufforderung geprüft werden.

## 30. Ausdrücklich vertagte Punkte

| Punkt | Einordnung |
|---|---|
| HA-Entity-Projektionen von Contracts (Dashboards/Automationen) | nach Alpha 1; dann ausschließlich als Spiegel ohne eigene Wahrheit (M17-05/06) |
| Umstellung bestehender Consumer (`blind_control` u. a.) auf `CoreContractsClient` | eigene Issues, Live-Gate Benni |
| Hochwertige Workbench-UX (Svelte 5, GridStack etc.) | spätere Alpha/Beta (Umbrella-UX, ADR 0001) |
| Cross-HA-Quellen (`source_origin` ≠ `local`) | spätere Erweiterung (§10.7) |
| Parameter-Audit (alle `[P]`-Werte, TTLs, Schwellen, Retry-Werte) | Konfiguration, getrennt |
| F-17 Schlafnacht-Grenze; Vergessen-Fall ohne TV; Multi-User/Gäste (A-07-Grenze) | zurückgestellt; Wiederaufnahme anhand realer Alpha-Betriebsdaten |
| Title-Classifier-Katalog als Core-Katalog | nach Alpha 1 |
| Stufe-B-Contracts, sofern in Alpha 1 nicht fertig | Alpha-Limits |
| History-Partitionierung/Aufbewahrung | Betrieb nach Alpha 1 (keine Löschung ohne Beschluss) |
| Climate-Policy-Block, Boost | Policy, nicht Core |
| `user_interaction`-Contract mit zentraler Provenienz | Hypothese; Alpha 1 nutzt die Origin-Regeln aus P4-60 §2 im Bio-SM |

---

## 31. Prozess nach Alpha 1

1. **Codex baut Alpha 1** gemäß diesem Dokument (`agent:codex` auf dem Build-Issue).
2. **Opus prüft** die Implementierung gegen dieses Dokument und die Fachakte (unabhängiger Review,
   eigener Lauf).
3. **Review-Befunde werden erneut kritisch geprüft** (Verifikation, Entfernen von Fehlbefunden).
4. **Codex korrigiert** die bestätigten Befunde.
5. Live-Installation, Cutover und Live Verified: **Benni**.

Ausdrückliche Review-Punkte: §9.3 (belegbare Kontinuität), §18 (DST-Konvention), §6.8-Feldnamen,
Single-Producer-Validierung, Commit-before-publish unter Fehlerinjektion, Bridge ohne Fachlogik.

---

## DOCUMENTATION DELTA

Die bestehenden Akten wurden **nicht** direkt bearbeitet. Begründung: Die Masterakte (≈ 940 KB) und die
sechs Nebenakten tragen wortgleiche Statusköpfe an vielen Stellen. Ein unvollständiger Patch würde
widersprüchliche Stände erzeugen. Dieses Dokument ist die konsolidierte Build-Quelle. Die folgenden
Patches sind exakt so in die Akten einzuarbeiten (additive Vermerke; historische Wortlaute bleiben).

### DD-1 Entfernung der Core-Profile
Neuer Abschlussvermerk (Masterakte neuer Abschnitt nach §55 sowie Protokoll und Offenregister):

> **Delta-Audit Core-Profile (2026-10-07): REMOVE CORE PROFILES FOR V1 · NO FREEZE IMPACT.**
> `profile` hat keinen eigenständigen Informationsgehalt. Jede Installation ist ein vollständig
> isolierter Core-Kontext (`installation → Registry → Contract-Instanzen → Bindings → Evidence`).
> Policy-Profile bleiben unberührt.

Zu ändernde Stellen (Vermerk an der Fundstelle):

| Stelle | Patch |
|---|---|
| P4-65 §11.1 CL-F1 (Master und Protokoll) | „Profil-/Installationskontexte“ → „Installationskontexte“; „Profil bei der Einrichtung festgelegt“ → „Installationsidentität (`installation_id`) bei der Einrichtung festgelegt“; „Profilkonfiguration“ → „Konfiguration der Installation (Core) bzw. Policy-Konfiguration (Policy)“. Inhalt sonst unverändert. |
| Kopfblock Z. 7 („Climate: Profile `benni`/`eltern`“) | → „Climate: Installationen Benni/Eltern (CL-F1)“ |
| P4-65 §11.4 Katalog #5, #6 | „Profil `eltern`“ → „Installation Eltern“ |
| P4-65 §15, §16, §55; P4-61 K4-Vermerk Z. 6402 | „Bindings je Profil“ / „Ausstattung je Profil“ → „je Installation“ |
| M06-01, M06-07, M06-12, M07-01, M14-11, M16-04 | Vermerk: „Ist-Befund v0.2.4. Zielmodell ohne Core-Profil; Isolation über Installation (App + DB). Felder `profile_id`/`profile` entfallen.“ |
| M17-01 | Vermerk: „Default `fehlt die Profilangabe → benni` ist Legacy und entfällt ersatzlos.“ |
| M17-02 (`ProfileId`-Import) | Vermerk: „abgelöst durch `CoreContractsClient` ohne Profilparameter“ |
| M18-11 (2) | Vermerk: „historisches Pro-App-Argument; superseded durch CL-F1 (eine App je Installation)“ |
| Offenregister §2r Zeile CL-F1 | „Profile `benni`/`eltern`“ → „Installationen Benni/Eltern; Core-Profile entfernt (Delta-Audit 2026-10-07)“ |

### DD-2 Ersatz durch `installation_id`
Neuer Eintrag (Master §30.10 als Fortschreibung M30-26):
> `installation_id` (UUID, beim Setup erzeugt, in `/data` und DB-Metadaten, beim Start geprüft, im
> Handshake sichtbar) ist die einzige Isolationsidentität. `installation_label` ist reine Anzeige.
> Nicht Teil von Contract-IDs oder DB-Zeilen. Kein Default-Kontext.

### DD-3 D1 — `parents` bei Blind/Sichtschutz
Vermerk an allen Fundstellen: „**Für Blind Control superseded durch P4-64 R-1a: `parents` wie `home`.**
Weiter gültig: `parents` eigener Ort; kein Sleep aus `parents`.“ Fundstellen:
- Statuskopf P4-61 (Z. 35), **wortgleich in allen sechs Nebenakten Z. 35**
- M21-16-Vermerke (Z. 2390–2391)
- **P4-62 §4 Consumer-Tabelle, Zeile Blind/Rollo** (Master Z. 6558, Protokoll Z. 5692, Audit-Checkpoint Z. 2905)
- M30-42 §4 (Z. 6464), lokal
- Offenregister §2o Zeile K5 (Z. 510)
- Protokoll Z. 2240

Nicht ändern: „Verworfene Zwischenhypothesen“ (Z. 6932 bzw. Protokoll Z. 6066, Audit Z. 3279).

### DD-4 D2 — Offenregister „Scope bei Eltern“
`Phase4_Offene_Punkte.md` Z. 583: Status → „**GESCHLOSSEN:** Media durch P4-63 §6 M-F (`parents` wie
`home`); Blind durch P4-64 §6 R-1a (`parents` wie `home`). Keine offene Benutzerentscheidung.“

### DD-5 D3 — historische Activity-Skizze
- M07-07 (Z. 738): Vermerk „**Historische Schema-Skizze.** Feldliste `activity` v1 (`active`, `variant`,
  `available`) ist keine aktuelle Felddefinition. Aktuell: M07-03 (keine separate Variant-Mechanik,
  hierarchische Werte) und M30-05 mit P4-54/55/58 (`tv`, `streaming`, `gaming`, `pc`, `other`, `idle`;
  `unknown`/`unresolved` als Status; Subkontext `service`). `available` als Quality-Projektion bleibt gültig (M08-14, A-04).“
- M08-03 (Z. 793): Vermerk „Pilot-Set `activity.gaming` mit `variant` = Plattform ist historisch;
  aktuelles Modell M07-03/M30-05. Umstellung ‚nach Shadow-Parität‘ ersetzt durch DD-7.“

### DD-6 Technische Baseline-Deltas
Neuer Abschnitt „Technische Baseline Alpha 1“ mit Verweis auf dieses Dokument §12–§25. Inhalt:
1. HA-I/O = Supervisor-App + Thin HA I/O Bridge über HA-WS-Kommandos (Grund: `state_reported` über die
   öffentliche API nicht abonnierbar).
2. DB-Ausfall: keine Publication ohne Commit; Readiness rot; Client „nicht bestätigt“; Recovery =
   logischer Restore + neue Epoche + sichtbare Lücke.
3. Watchdog nur Liveness.
4. DB je Installation, `installation_id`-Prüfung; Standort = Deployment-Konfiguration, WAN-Kopplung bewusst
   akzeptiert (präzisiert die frühere Empfehlung „standortlokal“).
5. Migrationen vorwärts, neueres Schema → Startverweigerung, Expand/Contract.
6. Secrets/Non-root im realen Supervisor-Modell; `hassio_api: false`.
7. M17-07 (Transport offen) und APP-01 §2c Punkte 1–5 sind durch §13–§16 technisch beantwortet. Vermerk
   an M17-07, M17-08 und Offenregister §2c.

### DD-7 No-Shadow-Entscheidung
Neuer Beschluss: „**Kein Shadow-Modus in V1.** `enabled=true` = produktiv; `enabled=false` = deaktiviert;
Draft = Entwurf ohne Auswertung.“ Vermerke:
- M12-09 und M17-06 (`shadow_only`, `published`-Pilot, `EntityProjectionGate`): Ist-Befund, Legacy.
- M08-03 (Z. 793) und M10-10 (Z. 1080, „erst … im Shadow laufen lassen“): Parität bzw. Bedarf wird über
  Tests, Szenarien und Live-Beobachtung aktivierter Contracts festgestellt, nicht über Shadow-Betrieb.
- M30-23 (Z. 4801), M19-06 (Z. 2079), M23-18 (Z. 2693) „nur Shadow-/Vergleichswerte“: präzisieren zu
  „Legacy-Werte nur als Vergleichs-/Testdaten, keine zweite Wahrheit, kein Shadow-Betrieb“.
- P4-60 §11 (Z. 6364) „F-17 bis Shadow zurückgestellt“ → „F-17 zurückgestellt bis zu realen
  Alpha-Betriebsdaten“.

### DD-8 Alpha-1-UX-Scope
Vermerk bei M20/§20 und ADR-0001-Bezug: „Alpha 1 enthält nur eine funktionale Engineering-/Admin-UI über
Ingress; keine Umbrella-UX, keine Workbench. Backend/API UI-neutral; UX-Layout-State ist kein Registry- oder Contract-State.“
Die frühere UX-Leitplanke „UI spricht mit der HA-Integration, die zum Service proxyt“ (M17-05
Ausnahmen) ist für Alpha 1 durch Ingress ersetzt.

---

## SELBSTPRÜFUNG (adversarial, vor Erstellung des Codex-Prompts)

| Prüfpunkt | Ergebnis |
|---|---|
| Widersprüchliche Ownership | keine; Fail-safe, Reaktionen und Reconciliation-Reaktion bei Policy; Core nur Wahrheit + technische Quellaktualisierung (§5.2, §13.5) |
| Core-Profile-Reste | keine; `profile`/`profile_id` nur noch als verbotene bzw. abzuweisende Felder (§10.2) und im DOCUMENTATION DELTA |
| Shadow-Reste | keine; `enabled` binär, Draft ohne Auswertung (§10.4) |
| Alte Activity-Schema-Reste | keine; A7 nutzt hierarchische Werte, `service`, `title`; `unknown`/`unresolved` nur als Status |
| `parents`-Blind-Semantik | korrekt: wie `home` (§6.8 Schluss) |
| Doppelte Truth-Producer | Single-Producer-Validierung (§6.4, §10.3); Ein-Pfad-Regel MQTT/HA (§8.4); Legacy-Übergang nur als gekennzeichnete Source |
| Widersprüchliche Restore-Regeln | bausteinspezifisch (§9.2); Latch nicht persistiert (M30-12/M08-08) vs. Baseline persistiert (M30-03) bewusst getrennt |
| Profilfelder in API/Bindings | keine (§10.2, §15, §15.6) |
| Bridge mit Fachlogik | ausgeschlossen (§13.2) |
| Publish-before-commit | ausgeschlossen (§12.3) |
| Watchdog an Readiness | ausgeschlossen (§14.2, §21) |
| Impliziter `benni`-Default | ausgeschlossen (§11.2, §15.6 Client ohne Default) |
| UX diktiert Backend | nein; UI nutzt öffentliche API, kein UI-State im Core (§26) |
| Gefundene und korrigierte Fehler im Entwurf | (1) Reconciliation-Refresh zunächst der Bridge zugeordnet → korrigiert: App über `call_service`, Bridge bleibt reiner Event-Transport. (2) Supervisor-Discovery zunächst als Token-Weg vorgesehen → entfällt, da die Bridge keine App-Tokens braucht. (3) Hysterese-Latch zunächst als persistiert geführt → korrigiert gemäß M30-12/M08-08. |

**Ergebnis:** Keine verbleibenden BUILD-SPEC BLOCKER. Bewusste Review-Punkte (kein Blocker): §9.3,
§18-DST-Konvention, §6.8-Feldnamen.
