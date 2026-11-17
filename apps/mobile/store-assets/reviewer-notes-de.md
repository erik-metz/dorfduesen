# Prüferhinweise – App Stores

**Nicht mit persönlichen Zugangsdaten veröffentlichen oder ins Repository eintragen.** Für die Prüfung sind ein dediziertes Testkonto und sichere Zugangsdaten über den jeweiligen vertraulichen Store-Prüfungsbereich bereitzustellen.

## Geplante Prüfschritte

1. App starten und den Einstieg öffnen.
2. „Mit Strava anmelden“ wählen. Die Anmeldung verlässt die App im Browser bzw. System-Authentifizierungsfenster und kehrt per Deep Link zurück.
3. Dashboard mit Laufjahr und Aktivitäten prüfen.
4. Eine Aktivität öffnen und verfügbare Detailwerte ansehen.
5. Physiologie, Trophäen und Düsen-Arena öffnen.
6. „Dorfdüsen-Konto löschen“ im Dashboard wählen, die Konsequenzen prüfen und die Löschung ausdrücklich bestätigen.

## Vor Einreichung ergänzen

- [ ] Dediziertes Testkonto mit reproduzierbaren Testdaten bereitstellen.
- [ ] Strava-Anmeldung für den Review-Zeitraum funktionsfähig halten.
- [ ] Falls die App ohne Strava-Konto nicht vollständig geprüft werden kann: nachvollziehbare Prüferhinweise und freigeschaltete Testdaten bereitstellen.
- [x] Kontolöschung im Dashboard auffindbar; Löschung löscht zugehörige Datensätze und versucht, Strava-Tokens zu widerrufen.
- [ ] Finale Datenschutz-URL für Prüfer eintragen, sobald Datenschutzhinweise fachlich vervollständigt sind.
- [ ] Kontaktperson für Rückfragen und Support ergänzen.
- [ ] Keine privaten Zugangsdaten, persönlichen Trainingsdaten oder echten Tokens in App-Build, Screenshot, Metadaten oder Git aufnehmen.

## Bekannte Einreichungs-Gates

- Datenschutz- und Kontolöschungsablauf muss für die ausgelieferte App dokumentiert und auffindbar sein.
- Die Verwendung von Strava-Daten, besonders Clubansichten mit Daten anderer Athletinnen und Athleten, vor Einreichung mit den geltenden Strava-Vorgaben abgleichen und erforderliche Freigaben klären.
- Apple Guideline 4.8 nennt eine Ausnahme für Clients eines bestimmten Drittanbieterdienstes, wenn Nutzer sich direkt beim Drittanbieterkonto anmelden müssen, um dessen Inhalte aufzurufen. Dorfdüsen benötigt Strava für die Laufdaten. Vor Einreichung prüfen, ob Apple diese Ausnahme angesichts zusätzlicher Club-, Health- und Trainingsfunktionen akzeptiert; andernfalls Sign in with Apple ergänzen.
