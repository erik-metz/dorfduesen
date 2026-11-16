# Revier: Gebietseinnahme durch Rundläufe

Outdoor-Läufe (`Run`, `TrailRun`) mit vollständigen Strava-GPS- und Zeitstreams können Gebiete einnehmen. Die Aktivitätsübersicht dient nur als Importquelle; die verbindliche Prüfung lädt die Originaldetails und `latlng,time`-Streams separat. Die Diagramm-Streams und vereinfachte Summary-Polyline werden nicht zur Grenzberechnung verwendet.

## Regeln, Version 1

- Die erste Saison beginnt mit dem Einspielen der Migration. Danach werden die Gebiete jeweils zu Quartalsbeginn um 00:00 UTC zurückgesetzt. Historische Läufe vor Aktivierung bleiben ausgeschlossen.
- Der gesamte Lauf muss innerhalb derselben Saison liegen. Der Abschlusszeitpunkt ist `start_date + elapsed_time`. Exakte Gleichstände werden nach stabiler lokaler Aktivitäts-ID sortiert.
- Start und Ziel: höchstens 100 Meter Abstand, zusätzlich höchstens 5 % der gemessenen Strecke. Nur diese kleine Lücke wird geschlossen.
- Mindestens 10.000 m² Fläche. Keine Selbstkreuzungen, manuellen, privaten oder Indoor-Aktivitäten. Health-Importe ohne GPS zählen nicht.
- Alle GPS-Punkte werden geprüft: gültige Koordinaten, streng aufsteigende Zeit, höchstens 200 Meter zwischen zwei Punkten, höchstens 12 m/s, gemessene Distanz innerhalb von 25 % der Originaldistanz. Maximal 30.000 Punkte. Aufzeichnungslücken werden nicht interpoliert. Strecken über den 180. Längengrad werden nicht unterstützt.
- Vollständig umschlossene fremde Gebiete wechseln den Besitzer. Eine gepufferte Grenze mit 10 Metern GPS-Toleranz ist erlaubt; höchstens 1 m² darf außerhalb liegen.
- Teilweise überdeckte fremde Gebiete bleiben erhalten. Neue Gebiete entstehen ausschließlich aus der noch freien Fläche. Fragmente unter 100 m² werden verworfen.
- Bestehende Grenzen bleiben auch bei Übernahme erhalten; keine automatische Zusammenführung eigener Nachbargebiete. Eigene Flächen zählen einmal.

## Speicherung und Konsistenz

`TerritorySettings` hält den einmaligen Aktivierungszeitpunkt. `TerritoryClaim` speichert höchstens eine aktuelle Prüfung je Aktivität, inklusive Quellfingerabdruck, Regelversion, Ergebnis und Geometrie. Die Fremdschlüsselbeziehung löscht die Prüfung beim lokalen Löschen einer Aktivität mit.

Der Besitz ist eine deterministische Projektion des chronologischen Laufjournals in `lib/territory/engine.ts`. Es gibt keine zweite, unabhängig mutierte Besitztabelle. Dadurch führen parallele Jobs, Wiederholungen und verspätete Imports zum selben Ergebnis. Eine geänderte lokale Aktivität wird sofort aus der Projektion ausgeschlossen, bis sie neu geprüft ist. Beim Speichern sperrt der Worker die Aktivitätszeile und prüft den Fingerabdruck erneut, damit verspätete HTTP-Antworten keine neuere Route überschreiben.

Die Projektion enthält Eigentümer, unveränderte Ursprungsgrenzen, erobernden Lauf, vollständige Historie pro Gebiet und Flächenrangliste. Die Übersicht zeigt die letzten 30 Gebietsereignisse und die letzten zehn eigenen Läufe mit Ergebnis/Ablehnungsgrund. Der Kartenbereich ist nur für angemeldete Mitglieder sichtbar; API-Antworten sind `private, no-store`. Cookie- und native Bearer-Sitzungen werden unterstützt.

## Import und Hintergrundjobs

Der bestehende Strava-Import sendet für geeignete Aktivitäten nach Aktivierung `territory/activity.check`, unabhängig von Trainingsplänen. Der Worker ruft Strava-Details und Streams ab. Unveränderte Aktivitäten werden höchstens einmal pro UTC-Tag erneut geladen. Fehler und Rate-Limits bleiben wiederholbare Inngest-Jobs; ein API-Fehler entfernt keine bereits gültigen Gebiete.

`territory-reconcile` läuft täglich um 05:30 Europe/Berlin und verteilt die aktuellen Saisonaktivitäten in Seiten zu je 100 auf einzelne Prüfjobs. Dadurch werden auch entfernte Strava-Aktivitäten (404), Privatsphäreänderungen und GPS-Änderungen außerhalb des siebentägigen Syncfensters erkannt. Änderungen können bis zur nächsten erfolgreichen täglichen Prüfung sichtbar bleiben. Das Event `territory/reconcile` startet den gleichen Abgleich manuell.

Neue Webkarten-Daten werden minütlich bei sichtbarem Tab geladen. Die mobile Arena nutzt dasselbe Datenmodell; Pull-to-refresh aktualisiert die Ansicht. Die Webkarte lädt Leaflet erst beim Anzeigen. Die mobile Karte verwendet `react-native-svg` und Web-Mercator-Kartenkacheln mit Zoom- und Verschiebesteuerung. Beide Karten verwenden OpenStreetMap-Kacheln und zeigen deren Attribution. Die externen Kacheln benötigen eine Internetverbindung; bei größerem Nutzerkreis sollte ein passender Kartenanbieter eingeplant werden.

## Rollout

1. Vor dem neuen Anwendungscode `npx prisma migrate deploy` ausführen. Die Migration ergänzt zwei Tabellen und löscht keine bestehenden Daten. Ihr Zeitpunkt ist der Start der ersten Saison.
2. Web-Anwendung bauen und deployen. `/api/inngest` synchronisieren, sodass `territory-evaluate` und `territory-reconcile` registriert sind.
3. Mobile App neu bauen: `react-native-svg` ist eine native Abhängigkeit (an die Expo-SDK-Version angepasst).
4. Einen neuen echten Rundlauf synchronisieren, Jobausführung prüfen und in Arena → Revier kontrollieren. Alternativ `territory/reconcile` auslösen.

Die Migration führt bewusst keinen Backfill alter Läufe aus. Saisonstart liegt in PostgreSQL, benötigt keine neue Umgebungsvariable und bleibt bei Deployments unverändert. Es gibt zunächst keine Verwaltungsoberfläche für abweichende Saisonzeiträume und keine Push-Benachrichtigungen; Gebietswechsel stehen in der Revierhistorie.

## Verifikation

- `tests/territory.test.mjs`: Rundschluss, kleine/offene/gekreuzte Strecken, GPS-Lücken, vollständige/teilweise Übernahme, Mehrfacheroberung, Toleranz, Wiederholungen, chronologische Neuordnung und Saisonwechsel.
- `tests/territory-database.test.mjs`: isolierte echte PostgreSQL-Datenbank; GPS-Abruf mit ersetzter Strava-API, Speicherung, verspäteter Import, wiederholte Verarbeitung, Quelländerung, private/gelöschte Aktivität und Löschkaskade.
- `tests/territory-http-smoke.mjs`: echter Produktionsserver, geschützter Endpunkt, gespeicherte Gebiete und identische Besitzstände über Cookie- und mobile Bearer-Sitzung.

Für die HTTP-Prüfung einen Produktionsserver mit der lokalen Testdatenbank starten und dann `TEST_BASE_URL`, `TEST_DATABASE_URL` und denselben `SESSION_SECRET` für `node tests/territory-http-smoke.mjs` setzen. Die CI führt diesen Check vor den bestehenden HTTP-Smoke-Tests aus.

Die Tests verwenden ausschließlich eine explizit angegebene lokale Datenbank mit `_test`-Suffix. Die Strava-API wird in automatisierten Tests ersetzt; ein echter GPS-Lauf muss nach dem Rollout als Produktionsprüfung folgen.
