# Core Contracts UX V1

Issue: [#38](https://github.com/Levtos/core-contracts/issues/38)

Die produktive Panel-UX verbindet fünf Aufgaben in einer Oberfläche:

1. Explorer: Verträge, Quellen und Geräte finden und vergleichen.
2. Inspector: einen Vertrag untersuchen, ohne die Liste zu verlassen.
3. Trace: Kandidatenwahl, Zeitstempel, Frische und Entscheidung erklären.
4. Abhängigkeiten: den vorhandenen Signalgraph fokussiert lesen.
5. Änderungen: Registry-Entwürfe prüfen, speichern und als Version aktivieren.

## Navigation und URL-Vertrag

Die Navigation liegt innerhalb des HA-Panels oben und erzeugt keine zweite
feste Sidebar. Ansichten werden über Hash-Routen adressiert. Vertrag und Feld
liegen in Query-Parametern, zum Beispiel:

```text
#/contracts?contract=opening.kitchen
#/trace?contract=opening.kitchen&field=open
```

Dadurch funktionieren direkte Aufrufe sowie Browser Vor/Zurück. Bei breiten
Panels steht der Inspector rechts neben der Liste, bei mittleren Breiten unter
der Liste und bei schmalen Panels als nahezu vollflächige Ebene.

## Zustände

Wert, Qualität, Frische, Lebenszeichen und Konfiguration bleiben getrennte
Achsen. `unknown` ist eine korrekt ermittelte neutrale Aussage und kein Fehler.
`degraded` kennzeichnet eine verwendbare Einschränkung, `blocked` einen
fachlichen Block, und fehlende Konfiguration erhält eine eigene Aktion.

Der Versionsrail zeigt in jeder Ansicht aktive Version, Entwurf,
Änderungsanzahl und Prüfstatus. Schreiben verwendet ausschließlich den
vorhandenen Registry-Draft-/Validate-/Save-Vertrag. Der Browser greift nicht
auf PostgreSQL zu.

## Daten- und API-Grenze

Für V1 war keine Backend- oder WebSocket-Erweiterung erforderlich. Die
bestehenden Contract-, Diagnostics-, Graph-, Registry-, Device-, Revision-
und Requirement-Payloads liefern die benötigten Informationen. Technische
Details bleiben im Trace zusätzlich aufklappbar; Roh-JSON ist nie die primäre
Darstellung.

## Verifikation

Die lokale Verifikation erfolgt ohne Preview-Server:

```text
cd frontend
npm ci
npm run check
npm test
npm run build
cd ..
python -m pytest
python scripts/validate_repository.py
```

Der Produktionsbuild schreibt das statische Panel-Bundle nach
`custom_components/benni_core_contracts/frontend/app/`. Eine echte Prüfung in
Einhornzentrale, Installation, Reload, Aktivierung oder Live-Verifikation ist
nicht Bestandteil der technischen Umsetzung und bleibt Bennis explizites Gate.
