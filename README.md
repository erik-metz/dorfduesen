# Dorfdüsen

Next.js-App für den Runclub Nordheim: Community-Statistiken, gemeinsame Strava-Aktivitätsdetails, Arena und Trainingscoach. Angemeldete Mitglieder dürfen die Aktivitätsdetails anderer Mitglieder sehen.

## Einrichtung

```sh
npm ci
cp .env.example .env.local
```

Platzhalter ersetzen; Zugangsdaten gehören nicht in Git.

| Variable | Verwendung |
| --- | --- |
| `DATABASE_URL` | PostgreSQL-Verbindung |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Strava-OAuth-Anwendung |
| `NEXT_PUBLIC_APP_URL` | Öffentliche Basis-URL einschließlich Protokoll |
| `SESSION_SECRET` | Eigener zufälliger Schlüssel mit mindestens 32 Zeichen |
| `CRON_SECRET` | Separater zufälliger Schlüssel mit mindestens 32 Zeichen für den HTTP-Cron-Endpunkt |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | In Produktion für Hintergrundjobs erforderlich |
| `XAI_API_KEY` | Optional; ohne Schlüssel verwendet der Coach den algorithmischen Generator |
| `XAI_MODEL` | Optionales Modell für den Coach |

Zufällige Schlüssel lassen sich mit `openssl rand -hex 32` erzeugen. Fehlende oder beispielhafte Session-Secrets werden abgelehnt; der Cron-Endpunkt ist ohne gültiges Secret deaktiviert (503). Ein Wechsel des Session-Schlüssels meldet bestehende Sitzungen ab.

Strava-Callback: `/api/auth/strava/callback`. Die Domain in der Strava-App passend zur Basis-URL konfigurieren.

```sh
npx prisma migrate deploy
npm run dev
```

Prisma-CLI liest `.env`; für CLI-Kommandos `DATABASE_URL` explizit setzen, wenn die Konfiguration nur in `.env.local` liegt. Für lokale Hintergrundjobs zusätzlich `npx inngest-cli dev` starten. In Produktion `/api/inngest` mit Inngest verbinden.

## Bestehende Datenbank übernehmen

Die erste Migration bildet die bereits vorhandene Struktur ab. **Bei einer bestehenden Datenbank diese Migration nicht ausführen und niemals `migrate reset` verwenden.** Erst Schema-Gleichheit mit der Baseline prüfen, dann die Baseline als bereits angewendet markieren:

```sh
npx prisma migrate resolve --applied 202610080001_baseline
npx prisma migrate deploy
```

Die zweite Migration ergänzt Tabellen für Generierungsversuche und Sync-Fortschritt sowie zwei Indizes. Bestehende Pläne werden in den Zähler übernommen. Keine Anwendungstabellen werden gelöscht. Vor dem Ausrollen des neuen App-Codes Migrationen anwenden. Neue, leere Datenbanken erhalten beide Migrationen über `migrate deploy`.

## Hintergrundjobs und Verhalten

- Der tägliche Sync startet um 04:00 Uhr in `Europe/Berlin` und verteilt einen Job pro Mitglied.
- Erstimporte laden alle Seiten bis zu einem gespeicherten Zeitpunkt. Seitenfortschritt wird dauerhaft gespeichert; ein neuer Job kann einen unterbrochenen Import fortsetzen.
- Nach dem Erstimport werden Aktivitäten seit dem letzten vollständigen Sync plus sieben Tagen Aktualisierungsfenster abgefragt. Das erfasst auch längere Ausfälle; ältere nachträglich geänderte oder gelöschte Strava-Aktivitäten werden dadurch nicht automatisch abgeglichen.
- Jeder Sync verarbeitet eine Seite je Inngest-Schritt. Rate-Limits verschieben Wiederholungen; eine Datenbank-Lease verhindert parallele Syncs desselben Mitglieds.
- Manuelle Syncs und HTTP-Cron-Aufrufe liefern `202` mit `queued: true`. Das bestätigt die Einreihung, nicht den Abschluss. Der Cron-Aufruf benötigt `Authorization: Bearer <CRON_SECRET>`; Secrets in Query-Parametern werden abgelehnt.
- Ein Lauf kann höchstens eine Trainingseinheit abschließen. Analyse-Events enthalten eine stabile ID je Lauf und Plan; die Datenbank prüft die Zuordnung zusätzlich.
- Der bisherige Trainingsplan bleibt während einer Ersatzgenerierung aktiv. Erst nach vollständiger Speicherung wird er pausiert. Fehler führen zu `FAILED`; der Versuch zählt zum Tageslimit von fünf. Das Löschen eines Plans setzt das Tageslimit nicht zurück.
- Wochen- und Monatsgrenzen richten sich nach Berlin. Abschlüsse verwenden einen exklusiven Endzeitpunkt und vergeben Trophäen atomar und höchstens einmal pro Titel und Zeitraum.

Fehlgeschlagene Inngest-Jobs im Inngest-Dashboard prüfen und nach Behebung erneut ausführen. Abgelaufene Sync-Leases werden automatisch wieder freigegeben. Fehlerhafte Planjobs können über die Oberfläche erneut angefordert werden. Datenbank-Backups und Aufbewahrungsfristen für Sync-Logs, Aktivitäten und Gesundheitsdaten gehören zur Betriebsverwaltung.

## Prüfungen

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Ohne `TEST_DATABASE_URL` laufen isolierte Tests; Datenbanktests werden übersprungen. Für Integrationstests eine separate lokale PostgreSQL-Datenbank mit einem Namen verwenden, der auf `_test` endet:

```sh
DATABASE_URL=postgresql://USER:PASS@localhost:5432/dorfduesen_test npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://USER:PASS@localhost:5432/dorfduesen_test npm test
```

Integrationstests prüfen echte Transaktionen, parallele Planreservierungen und Aktivitätszuordnungen, Rollback bei fehlgeschlagenem Planwechsel, Trophäen-Idempotenz, Sync-Leases und Token-Rotation. Externe APIs werden ersetzt; Testnutzer werden anschließend entfernt. Die GitHub-Checks führen diese Tests mit einer temporären PostgreSQL-Instanz aus und prüfen nach dem Build die echten HTTP-Endpunkte mit `tests/http-smoke.mjs`.

Für lokale HTTP-Prüfungen einen separaten App-Prozess mit der Testdatenbank und einem eigenen `SESSION_SECRET` starten. Anschließend `TEST_BASE_URL`, `TEST_DATABASE_URL` und denselben `SESSION_SECRET` für `node tests/http-smoke.mjs` setzen. Die Prüfungen erzeugen ausschließlich lokale Testnutzer und prüfen auch die beabsichtigte Detailfreigabe unter Mitgliedern.

## Wochen-Highlights ab der laufenden Woche vom 05.10.2026

Die Migration `20261009120000_weekly_goals` vor dem neuen App-Code mit `npx prisma migrate deploy` anwenden. Sie ergänzt ausschließlich persönliche Wochenziele. Abgeschlossene Wochen vor dem 05.10.2026 werden weiter nach den alten Regeln berechnet; vorhandene Trophäen bleiben erhalten.

Lauf- und Radleistung werden getrennt ausgezeichnet (Run/TrailRun/VirtualRun bzw. Ride/MountainBikeRide/GravelRide/VirtualRide/Handcycle/Velomobile; keine E-Bikes). Exakte Gleichstände teilen den Titel. Persönliche Ehrungen gelten für alle Sportarten mit positiver Bewegungszeit: zwei aktive Tage, drei Wochen in Folge mit zwei aktiven Tagen, vor Wochenstart gewähltes Tagesziel und Fortschritt gegenüber vier vollständigen Vorwochen. Mitgliedschaft muss für den Fortschrittsvergleich mindestens seit Beginn dieser vier Wochen bestehen; Nullwochen zählen mit. Ein lokaler Aktivitätstag zählt einmal.

Ziele werden authentifiziert für die jeweils nächste Berliner Kalenderwoche gespeichert und können nur vor deren Beginn geändert werden. Die Arena zeigt sechs kompakte Karten: Sohlen runter., Kette rechts., Sofa hat verloren., Dauer-Düse., Eine Schippe drauf. und Vorgenommen. Durchgezogen. Jede Karte zeigt eine hervorgehobene Person, die Leistung und einen persönlichen Anreiz. Innerhalb persönlicher Kategorien werden weniger oft ausgezeichnete Mitglieder bevorzugt; bei gleichem Stand wechselt die Reihenfolge pro Woche. Soweit möglich wird jede Person nur einmal für persönliche Erfolge hervorgehoben. Ein Klick öffnet alle Qualifizierten und die Regeln in einem Dialog. Das Zielformular befindet sich ausschließlich im eigenen Dashboard unter Trophäen. Dauerhafte Ehrungen werden am Wochenabschluss für jede qualifizierte Person idempotent vergeben, ohne Benachrichtigungen über verlorene persönliche Erfolge.
