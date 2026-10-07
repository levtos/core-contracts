# Dokumentation — Übersicht (Alt / Neu)

Dieses Repository wandelt sich von der Home-Assistant-Integration `benni_core_contracts` (v0.2.x)
zur **Core-Contracts-Supervisor-App (Alpha 1)**. Die Dokumentation ist entsprechend getrennt.

## Neu — Alpha 1 (Zielarchitektur, verbindlich)

| Dokument | Zweck |
|---|---|
| [alpha1/build-specification.md](alpha1/build-specification.md) | **Primäre Build-Quelle**: konsolidiertes Lastenheft Alpha 1, inkl. DOCUMENTATION DELTA und Selbstprüfung |
| [alpha1/codex-build-prompt.md](alpha1/codex-build-prompt.md) | Bauauftrag für Codex |
| [alpha1/technical-baseline-check-2026-10-07.md](alpha1/technical-baseline-check-2026-10-07.md) | Technischer Plausibilitätscheck (`TECHNICAL BASELINE CONFIRMED`, HA-I/O-Entscheidung) |
| [alpha1/profile-delta-audit-2026-10-07.md](alpha1/profile-delta-audit-2026-10-07.md) | Delta-Audit: Core-Profile entfernt, Dokumentationskorrekturen D1–D3 |

Fachliche Rückfallquelle ist die Core-Contracts-Entscheidungsakte (Phase 4 · Auditrevision, Stand P4-65).
Sie und ihre Nebenakten liegen **nicht** in diesem öffentlichen Repository, weil sie private
Haushaltsdaten enthalten. Sie bleiben lokales Archiv des Owners.

## Alt — Legacy-Integration `benni_core_contracts` (v0.2.x, superseded)

Alle übrigen Dateien direkt unter `docs/` beschreiben die bisherige HA-Integration (Profile, Shadow-/
Published-Pilot, Evidence-Gates, Registry v1/v2, UX V1/V2, Release-Notes). Sie sind **historisch** und
durch die Alpha-1-Spezifikation abgelöst. Wo sie widersprechen, gilt Alpha 1, insbesondere: keine
Core-Profile, kein Shadow-Modus, Supervisor-App + Thin HA I/O Bridge.

Die Legacy-Dateien bleiben vorerst an ihrem Ort, weil bestehende Tests auf `docs/`-Pfade verweisen.
Mit dem Alpha-1-Umbau, wenn die Legacy-Integration entfernt wird, werden sie nach `docs/legacy-v1/`
verschoben.
