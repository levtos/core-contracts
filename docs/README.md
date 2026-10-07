# Dokumentation — Übersicht (Alt / Neu)

Dieses Repository enthält die Home-Assistant-Integration `benni_core_contracts` (v0.2.x, Legacy).
Die Neuentwicklung als **Core-Contracts-Supervisor-App** findet im eigenen Repository
[Levtos/core_contract_app](https://github.com/Levtos/core_contract_app) statt.

## Neu — Core Contracts App (verbindlich, anderes Repository)

- **Phase 1 — Platform Foundation (Alpha 1):**
  [docs/platform-alpha1/](https://github.com/Levtos/core_contract_app/tree/main/docs/platform-alpha1)
  (Build-Spezifikation, Codex-Prompt) und
  [docs/audits/](https://github.com/Levtos/core_contract_app/tree/main/docs/audits)
  (technischer Baseline-Check, Delta-Audit Core-Profile).
- **Phase 2 — Domain Contracts + Consumer Migration:** erst nach dem Acceptance Gate von Phase 1.

## Superseded

| Dokument | Status |
|---|---|
| [alpha1/build-specification.md](alpha1/build-specification.md) | **SUPERSEDED**: vermischte Phase 1 und 2; das DOCUMENTATION DELTA (DD-1 bis DD-8) gilt inhaltlich weiter |
| [alpha1/codex-build-prompt.md](alpha1/codex-build-prompt.md) | **SUPERSEDED, nicht ausführen**; Bauauftrag #46 geschlossen |
| [alpha1/technical-baseline-check-2026-10-07.md](alpha1/technical-baseline-check-2026-10-07.md) | inhaltlich gültig; aktuelle Fassung in `core_contract_app/docs/audits/` |
| [alpha1/profile-delta-audit-2026-10-07.md](alpha1/profile-delta-audit-2026-10-07.md) | inhaltlich gültig; aktuelle Fassung in `core_contract_app/docs/audits/` |

## Alt — Legacy-Integration `benni_core_contracts` (v0.2.x)

Alle übrigen Dateien direkt unter `docs/` beschreiben die bisherige HA-Integration (Profile, Shadow-/
Published-Pilot, Evidence-Gates, Registry v1/v2, UX V1/V2, Release-Notes). Sie sind **historisch**.
Wo sie widersprechen, gilt die Core Contracts App: keine Core-Profile, kein Shadow-Modus,
Supervisor-App + Thin HA I/O Bridge. Die Integration bleibt bis zur Ablösung in Phase 2 unverändert in
Betrieb.

Die fachliche Entscheidungsakte und ihre Nebenakten liegen in keinem öffentlichen Repository, weil sie
private Haushaltsdaten enthalten.
