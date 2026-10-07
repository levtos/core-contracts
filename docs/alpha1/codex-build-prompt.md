> **⛔ SUPERSEDED (2026-10-07) — NICHT AUSFÜHREN.** Dieses Dokument vermischte Phase 1 (Platform Foundation) und Phase 2 (Domain Contracts); der zugehörige Bauauftrag #46 ist geschlossen. Gültig: [Levtos/core_contract_app → docs/platform-alpha1/](https://github.com/Levtos/core_contract_app/tree/main/docs/platform-alpha1). Das DOCUMENTATION DELTA (DD-1 bis DD-8) gilt inhaltlich weiter.

# Codex-Auftrag: Core Contracts Alpha 1 bauen

Du bist **Codex** und implementierst **Core Contracts Alpha 1**. Das ist ein Bauauftrag, kein
Analyse- oder Planungsauftrag. Du legst Dateien an, baust Code um, schreibst und führst Tests aus,
baust Images und behebst Fehler, bis die Akzeptanzkriterien erfüllt sind oder ein echter Grenzfall
dokumentiert ist. Frage nicht nach jedem Schritt nach Bestätigung.

---

## 1. Autorität

1. **Primäre Build-Quelle:** `docs/alpha1/build-specification.md` im Repo `Levtos/core-contracts`
   („Spezifikation“).
2. **Fachliche Rückfallquelle:**
   `D:\Dokumente\Core-Contracts-Konsolidierung\final\Core_Contracts_Master_Entscheidungsakte_Phase4_Auditrevision.md`
   („Fachakte“, Stand einschließlich P4-65). Die Fachakte liegt **nur lokal**, weil sie private
   Haushaltsdaten enthält. Sie wird **nicht** ins (öffentliche) Repo kopiert, auch nicht auszugsweise mit
   personenbezogenen Details. Die in der Spezifikation genannten Fundstellen (`M30-05`, `P4-60 §5` …)
   liest du dort nach und implementierst sie vollständig.
3. Bei Widerspruch gilt die Spezifikation für alle dort konsolidierten Deltas: Core-Profile entfernt,
   `installation_id`, D1–D3, technische Baseline, Thin HA I/O Bridge, kein Shadow-Modus,
   Alpha-1-UX-Scope. Für sonstige Domain-Semantik gilt die Fachakte.
4. Nicht als Quelle verwenden: `Core_Contracts_Master_Entscheidungsakte.md`, `…_Phase4.md`,
   `…_Step3b.md`, `…_Step3c.md`.
5. Historische Ist-Befunde der Fachakte sind Legacy, kein Soll.

Die Spezifikation, dieser Prompt und die Audits liegen bereits unter `docs/alpha1/` im Repo
(Übersicht: `docs/README.md`). Referenziere die Spezifikation in allen Commits und im PR. Änderst du
die Spezifikation nicht, bleibt sie unverändert; Abweichungen gehören nach `docs/alpha1/deviations.md`.

## 2. Governance (verbindlich)

- Lies zuerst `AGENTS.md` des Zielrepos und
  [Levtos/control/docs/](https://github.com/Levtos/control/tree/main/docs) inklusive ADR 0002
  (`Levtos/control#21`). Für UX-Teile zusätzlich ADR 0001 (`Levtos/control#17`). Nutze CTX zuerst,
  falls verfügbar.
- Arbeite unter genau einem GitHub-Issue mit Agent-Kennzeichnung **`agent:codex`** (im Repo
  `Levtos/core-contracts` als Label `owner/codex` geführt):
  **Issue: `<ISSUE-URL — von Benni einzutragen>`**. Fehlt es, lege in `Levtos/core-contracts` ein Issue
  „Core Contracts Alpha 1 — Build gemäß Build-Spezifikation“ an. Es enthält oben einen Abschnitt
  **„Aktueller verbindlicher Vertrag“** mit Verweis auf die Spezifikation, Label `owner/codex`.
  Dann arbeite darunter.
- Zielrepository: **`Levtos/core-contracts`**. Arbeite in einem **frischen Clone oder isolierten
  Worktree** vom verifizierten Default-Branch (`main` auf GitHub). Lokale Alt-Checkouts unter
  `D:\Dokumente\GitHub\core-contracts` werden nicht verwendet und nicht überschrieben.
- Ein Branch `agent/alpha1-build`, ein PR. Kein Release, kein Tag, kein HACS- oder App-Store-Channel-Update,
  keine Installation auf einer echten HA-Instanz. **Live und Live Verified sind Bennis Gate.**
  Hintergrund: `blind_control` konsumiert heute live die Legacy-Integration.
- Keine privaten Daten, Secrets, Tokens, Zugangsdaten, IP-Adressen, Hostnamen oder Infrastruktur-Topologie
  in Repo, Issue, Commits, Logs oder Testdaten. Beispielkonfigurationen nutzen Platzhalter
  (`sensor.example_…`).
- Neue Funde außerhalb des Scopes werden als eigene Issues notiert, nicht miterledigt.

## 3. Was du nicht ändern darfst

Folgendes ist entschieden und darf nicht eigenmächtig geändert werden: Ownership Core/Policy/Apply ·
Contract-Semantik · Quality-Status (`valid`, `held`, `unknown`, `not_applicable`, `unresolved`) ·
Freshness- und Evidence-Regeln · Grace/Held-Propagation · Temporal · Restore (bausteinspezifisch) ·
Registry-Modell · **kein Shadow-Modus** · **keine Core-Profile** · `installation_id` ·
HA-I/O-Grenze (Supervisor-App + Thin Bridge) · Commit-before-publish · Consumer-Grenze
(`CoreContractsClient`, HTTP/WS) · Watchdog nur an Liveness.

Du darfst lokale, reversible technische Detailentscheidungen treffen, zum Beispiel interne
Modulstruktur, Hilfsklassen, Tabellen-Detailnamen oder Queue-Größen als konfigurierbare Werte.

Bei einem **echten** Widerspruch:
1. Dokumentiere ihn sichtbar in `docs/alpha1/deviations.md` und im Issue.
2. Implementiere die konservativste Variante, die keine neue Semantik erfindet (im Zweifel `unknown` mit
   Reason statt Ersatzwert).
3. Arbeite am übrigen Scope weiter.

Erfinde keine Fachsemantik und keine Zahlenwerte. Fehlende Parameter sind Registry-Konfiguration ohne
Code-Default (Spezifikation §10.6).

Verboten in Code, Schema, API und UI: `profile`, `profile_id`, Profilparameter, Default `benni`,
`consumer_ids`, `shadow`/`shadow_only`/`published`-Modi, generisches `set_state`, `safe_default`/`hold_last`,
freie Ausdrücke (Jinja/Python/eval), MQTT-Contract-Bus, Fachlogik in der Bridge, DB-Zugriff für Consumer,
Publish vor Commit, Watchdog an Readiness, private `asyncpg`-Interna, Docker-Socket, privileged,
`hassio_api: true`, Dependency-Auflösung beim Start, `build.yaml`.

## 4. Vorhandenen Code zuerst untersuchen (Phase 1)

Untersuche vor größeren Änderungen und schreibe `docs/alpha1/reuse-analysis.md`. Je Bestandteil gibt es
eine Zeile `reuse | adapt | replace | legacy/remove` mit kurzer Begründung:

- `Levtos/core-contracts`:
  - `custom_components/benni_core_contracts/*`: Graph, Quality, Freshness, Fusion, Schema, Models,
    Registry-Service/-Store, Storage-Codec, ConsumerApi, Source-Listener, WebSocket-API, Gates.
  - `migrations/`, `tests/`, `frontend/` (Svelte 5/Vite/TS), `scripts/`, `.github/workflows/`.
- Faustregeln:
  - **Reuse/Adapt:** reine, HA-freie Domainmodule (Frozen-Dataclasses), Fusion-Strategien,
    Freshness-Bausteine, Registry-Revisions-/OCC-Logik, kanonische Serialisierung/Checksummen,
    brauchbare Tests, Frontend-Toolchain/Komponenten.
  - **Legacy/Remove:** Profile (`profiles.py`, `ProfileId`, `profile_id`), Shadow/Published/Gate-Pakete
    (`shadow*.py`, `published.py`, `evidence_gate.py`, `owner_required_gate.py`, `live_evidence.py`,
    `source_binding_evidence.py`), `consumer_ids`, `hass.data`-Consumer-Pfad, HA-Store-Restore,
    ConfigEntry-gebundener Lebenszyklus, Default `benni`, fallback-überschreibende Registry-Logik (B1),
    „Lesen löst Auswertung aus“ (B14).
- Nur lesend, als Port-Quelle (nicht ändern):
  - `Levtos/benni-core-state`: **1:1-Port** von `day_phase` (9 Phasen) und der Wake-Planungslogik
    (Spezifikation §6.8 A5/A6). Dokumentiere die Vorlaufformel aus dem Code. Bio-Ist nur als
    Migrationsdelta (Soll steht in Fachakte P4-60).
  - `Levtos/blind_control`: nur für Stufe B3 (erwartete Strahlung, Port C-06).
- `Levtos/plug_policy_engine` und `Levtos/benni_door_policy`: kein Reverse Engineering, keine Änderung
  (Befund `KEIN FUNDAMENTALER CORE-GAP`). Sie sind spätere Consumer.

Keine Neuschreibung aus Bequemlichkeit. Kein Architekturbruch, nur weil Legacy-Code existiert.

## 5. Arbeitsplan (iterativ, ohne Zwischenfreigaben)

1. **Bestand analysieren** → `reuse-analysis.md`.
2. **Build-Plan** aus der Spezifikation ableiten → `docs/alpha1/build-plan.md`. Kurz halten, Reihenfolge
   wie hier.
3. **Projektstruktur** gemäß Spezifikation §14.1 herstellen: `pyproject.toml` (uv, Python 3.14),
   `uv.lock`, Ruff/mypy/pytest-Konfiguration, `src/core_contracts`, `client/core_contracts_client`,
   `custom_components/core_contracts_bridge`, `core_contracts/` (App), `migrations/`, `dev/`
   (Compose + Fake-HA), `repository.yaml`, `hacs.json` für die Bridge.
4. **Domain- und Schema-Basis:**
   - Clock/FakeClock (§18).
   - Observation, Status/Quality/Reason, Envelope (§7, §8, §15.3).
   - Schemas und Value-Catalog (§6.3).
   - Resolver-Operatoren, Fusion inkl. `opening_contacts`, Temporal (§6.5, §6.6, §9.1).
   - SM-Framework mit Episoden, Deadlines, Commands, Guards (§6.7).
   - Semantik-Fingerprint (§9.6).
5. **Persistenz und Migration:**
   - SQL-Migrationen und Runner (§12.6), Tabellen (§12.2).
   - Writer-Lock (§12.5), Commit-before-publish-Changesets (§12.3).
   - `installation_id`-Logik inkl. aller Fälle aus §11.2.
   - Registry-Revisionen, Drafts, Validierung, Aktivierung, Rollback, Import (§10).
6. **Runtime und Processing:**
   - Supervisierte Tasks, begrenzte Queues, serialisierter Processor (§14.4).
   - Startup/Shutdown (§14.5), Restore-Ablauf und bausteinspezifische Regeln (§9.2–§9.5).
   - DB-Ausfall und Recovery (§12.4), Epochen.
7. **Thin HA I/O Bridge** (§13): Integration und App-seitiger HA-Adapter (Snapshot, `changed`,
   `reported`, absent, Lifecycle, Reconnect, Gaps, keine Fallbacks).
8. **Consumer/API** (§15, §16): aiohttp mit zwei Listenern, alle Endpunkte, WS-Protokoll mit
   `prev_seq`/Resync, Commands mit Idempotenz, `CoreContractsClient`, Tokens (§19).
9. **MQTT** (§17): aiomqtt-Adapter, Retain/QoS/Dedupe, Services-API-Modus, Ein-Pfad-Validierung.
10. **Referenz-Contracts Stufe A** (§6.8 A1–A10) vollständig nach den Fachakte-Fundstellen, dazu eine
    Beispiel-Registry `docs/alpha1/example-registry.json` mit Platzhaltern und `PARAMETER-AUDIT`-Kommentaren.
    Danach **Stufe B**, soweit möglich.
11. **Alpha-Admin-UI** (§26) über Ingress, ausschließlich gegen die öffentliche API. Frontend-Wiederverwendung
    gemäß Analyse.
12. **Tests** (§27) vollständig: unit, scenario, integration (PostgreSQL via `dev/compose.yaml`), bridge
    (Fake-HA-WS-Server; zusätzlich echter HA-Dev-Container, falls verfügbar), e2e, container-smoke.
13. **Packaging:** Multi-Stage-Dockerfile mit explizitem `FROM` (glibc, Python 3.14), non-root via
    Entrypoint-Rechteabgabe, `config.yaml` gemäß §14.2, Multi-Arch-Build amd64/aarch64 (buildx). Bridge
    HACS-fähig, Client als Wheel baubar.
14. **Vollständige Test- und Build-Runde**, Fehler beheben, wiederholen.
15. **Dokumentation:** `docs/alpha1/operations.md` (Installation, Bridge-Setup, Tokens, PG-Anlage je
    Installation, Backup/Restore-Runbook, Upgrade), `docs/alpha1/api.md`, `deviations.md`, README
    aktualisieren, `CHANGELOG.md`.

Führe Tests nach jedem größeren Schritt aus. Committe in sinnvollen Einheiten mit aussagekräftigen
Messages, die die Spezifikationsabschnitte nennen.

## 6. Qualitätsanforderungen

- `ruff check` und `ruff format --check` sauber. `mypy --strict` für `src/` und `client/` ohne Fehler.
  Ruff-Regeln verbieten direkte Zeitzugriffe außerhalb der Clock (`DTZ`, banned-api).
- Kein `# type: ignore` ohne Begründung. Keine stummen `except Exception: pass`.
- Jeder Reason-Code stammt aus dem zentralen Katalog (§7.4).
- Jeder `unknown`-Status hat Reason und betroffenen Input.
- Pydantic v2 an Wire-, Config-, Registry- und Persistenzgrenzen. Im Domainkern dürfen Frozen-Dataclasses bleiben.
- Keine Ad-hoc-Timer außerhalb von Scheduler und Clock. Kein verstecktes Resolver-Gedächtnis.
- Keine absichtlich schlampigen Provisorien: Persistenz, Restore, Quality und Tests werden nicht
  vereinfacht oder vorgetäuscht. Was nicht fertig wird, wird als Alpha-Limit berichtet, nicht verdeckt.

## 7. Umgebung und nicht ausführbare Schritte

- Läuft Docker oder PostgreSQL nicht, laufen Unit- und Szenario-Tests trotzdem. Integrationstests werden
  sauber als „skipped: environment“ markiert und im Bericht aufgeführt, nicht gelöscht.
- Supervisor- bzw. HA-spezifische Nachweise, die ohne echte Supervisor-Umgebung nicht möglich sind
  (Spezifikation §29), werden als **Build-Time Verification offen** berichtet. Falls möglich, bereite
  Skripte bzw. Checklisten dafür vor.
- Scheitert eine Build-Time-Verifikation, suche zuerst eine technische Korrektur innerhalb der
  Spezifikation. Erfinde keine neue Semantik.

## 8. Abschluss

1. PR gegen `main` von `Levtos/core-contracts` mit Verweis auf das Issue und die Spezifikation. Kein
   Merge-Zwang durch dich, keine Releases. PR-Beschreibung = Abschlussbericht (unten).
2. Kommentar im Issue mit demselben Bericht. Board-Status höchstens „Testing“/„Tests Pass“, **nicht Live**.

### Abschlussbericht (Pflichtstruktur)

```
## Implementiert
(je Spezifikationsabschnitt; Stufe-A-Contracts einzeln; Stufe B einzeln)

## Wiederverwendet
(Bestandteil → reuse/adapt mit Pfad)

## Entfernt / superseded
(Legacy-Bestandteile mit Begründung; Profile, Shadow, Gates, hass.data-Pfad …)

## Tests bestanden
(Suites mit Anzahl; Befehle)

## Tests nicht ausführbar
(Suite/Fall → Grund)

## Build-Time Verification offen
(§29-Punkte mit Stand)

## Bekannte Alpha-Limits
(z. B. nicht fertige Stufe-B-Contracts, History-Wachstum, UI-Lücken)

## Migration / Installationshinweise
(App-Repository, Bridge, PG-Anlage je Installation, Tokens, Legacy-Import-Draft, Hinweis blind_control-Cutover = Benni)

## Abweichungen von der Spezifikation
(jede einzeln mit Begründung und Spezifikationsverweis; leer nur, wenn wirklich keine)
```

Danach folgt ein unabhängiger Review durch Opus gegen Spezifikation und Fachakte. Bestätigte Befunde
korrigierst du in einem Folgeauftrag. Halte deshalb die Abweichungsliste vollständig und ehrlich.
