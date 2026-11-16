# Revier: Gebietseinnahme durch Rundläufe

Outdoor-Läufe (`Run`, `TrailRun`) mit vollständigen Strava-GPS- und Zeitstreams können Gebiete einnehmen. Die Aktivitätsübersicht dient nur als Importquelle; die verbindliche Prüfung lädt die Originaldetails und `latlng,time`-Streams separat. Die Diagramm-Streams und vereinfachte Summary-Polyline werden nicht zur Grenzberechnung verwendet.

## Regeln, Version 2

- Die erste Saison beginnt mit dem Einspielen der Migration. Danach werden die Gebiete jeweils zu Quartalsbeginn um 00:00 UTC zurückgesetzt. Standardmäßig bleiben historische Läufe vor Aktivierung ausgeschlossen. Ein ausdrücklich gestarteter Backfill kann die erste Saison bis zum aktuellen Quartalsbeginn erweitern.
- Der gesamte Lauf muss innerhalb derselben Saison liegen. Der Abschlusszeitpunkt ist `start_date + elapsed_time`. Exakte Gleichstände werden nach stabiler lokaler Aktivitäts-ID sortiert.
- Start und Ziel: 100 Meter Grundtoleranz, bei längeren Läufen bis zu 10 % der gemessenen Strecke, maximal 300 Meter (`min(300, max(100, Strecke × 0,10))`). Nur diese Abschlusslücke wird geschlossen.
- Mindestens 10.000 m² je eingeschlossener Teilfläche. Kreuzungen (z. B. eine Acht), wiederholt gelaufene Abschnitte und ein gemeinsamer Zugangsweg sind erlaubt. Die Grenze wird mit der Non-zero-Regel in echte, überschneidungsfreie Flächen zerlegt; es wird keine konvexe Hülle verwendet. Kleine GPS-Schleifen werden verworfen. Ein 15-Meter-Innenpuffer muss mindestens 100 m² übriglassen, damit schmale GPS-Streifen entlang eines Hin-/Rückwegs keine Gebiete erzeugen. Manuelle, private und Indoor-Aktivitäten sowie Health-Importe ohne GPS zählen nicht.
- Alle GPS-Punkte werden geprüft: gültige Koordinaten, streng aufsteigende Zeit, höchstens 200 Meter zwischen zwei Punkten, höchstens 12 m/s, gemessene Distanz innerhalb von 25 % der Originaldistanz. Maximal 30.000 Punkte. Aufzeichnungslücken werden nicht interpoliert. Strecken über den 180. Längengrad werden nicht unterstützt.
- Vollständig umschlossene fremde Gebiete wechseln den Besitzer. Eine gepufferte Grenze mit 10 Metern GPS-Toleranz ist erlaubt; höchstens 1 m² darf außerhalb liegen.
- Teilweise überdeckte fremde Gebiete bleiben erhalten. Neue Gebiete entstehen ausschließlich aus der noch freien Fläche. Fragmente unter 100 m² werden verworfen.
- Bestehende Grenzen bleiben auch bei Übernahme erhalten; keine automatische Zusammenführung eigener Nachbargebiete. Eigene Flächen zählen einmal.

## Speicherung und Konsistenz

`TerritorySettings` hält den einmaligen Aktivierungszeitpunkt. `TerritoryClaim` speichert höchstens eine aktuelle Prüfung je Aktivität, inklusive Quellfingerabdruck, Regelversion, Ergebnis und Geometrie. Die Fremdschlüsselbeziehung löscht die Prüfung beim lokalen Löschen einer Aktivität mit.

Der Besitz ist eine deterministische Projektion des chronologischen Laufjournals in `lib/territory/engine.ts`. Es gibt keine zweite, unabhängig mutierte Besitztabelle. Dadurch führen parallele Jobs, Wiederholungen und verspätete Imports zum selben Ergebnis. Eine geänderte lokale Aktivität wird sofort aus der Projektion ausgeschlossen, bis sie neu geprüft ist. Ein Regelwechsel erzwingt über die Regelversion eine erneute Prüfung. Unveränderte gültige Ergebnisse der vorherigen Version bleiben bis zur Neubewertung sichtbar; ihr Fingerabdruck wird mit ihrer gespeicherten Regelversion geprüft. Beim Speichern sperrt der Worker die Aktivitätszeile und prüft den Fingerabdruck erneut, damit verspätete HTTP-Antworten keine neuere Route überschreiben.

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

Die Migration führt selbst keinen Backfill alter Läufe aus. Für vorhandene Läufe der aktuellen Quartalssaison gibt es `node --env-file=.env scripts/backfill-territories.mjs`: Zunächst werden ohne Änderungen Anzahl und Zeitraum angezeigt. Mit `--apply` wird der Teilnahmebeginn bei Bedarf auf den Quartalsbeginn vorgezogen und `territory/reconcile` gesendet. Alte `OLD`-Prüfungen innerhalb dieses Zeitraums werden für eine erneute Prüfung freigegeben. Wiederholungen sind sicher; abgeschlossene frühere Quartale werden nicht in die aktuelle Besitzkarte übernommen. Die Ausführung erfordert eine erreichbare Datenbank und einen produktiven `INNGEST_EVENT_KEY`. Ein erfolgreich gesendetes Event bestätigt die Einreihung, nicht den Abschluss der GPS-Prüfung.

Saisonstart liegt in PostgreSQL, benötigt keine neue Umgebungsvariable und bleibt bei Deployments unverändert. Es gibt zunächst keine Verwaltungsoberfläche für abweichende Saisonzeiträume und keine Push-Benachrichtigungen; Gebietswechsel stehen in der Revierhistorie.

## Verifikation

- `tests/territory.test.mjs`: Rundschluss mit 100–300 Metern Toleranz, offene und kleine Strecken, Achterrunden, gemeinsame Zugangswege, GPS-Schleifen, schmale Hin-/Rückweg-Streifen, erhaltene Löcher und GPS-Lücken, vollständige/teilweise Übernahme, Mehrfacheroberung, Toleranz, Wiederholungen, chronologische Neuordnung und Saisonwechsel.
- `tests/territory-database.test.mjs`: isolierte echte PostgreSQL-Datenbank; GPS-Abruf mit ersetzter Strava-API, Speicherung, verspäteter Import, wiederholte Verarbeitung, Quelländerung, private/gelöschte Aktivität und Löschkaskade.
- `tests/territory-http-smoke.mjs`: echter Produktionsserver, geschützter Endpunkt, gespeicherte Gebiete und identische Besitzstände über Cookie- und mobile Bearer-Sitzung.

Für die HTTP-Prüfung einen Produktionsserver mit der lokalen Testdatenbank starten und dann `TEST_BASE_URL`, `TEST_DATABASE_URL` und denselben `SESSION_SECRET` für `node tests/territory-http-smoke.mjs` setzen. Die CI führt diesen Check vor den bestehenden HTTP-Smoke-Tests aus.

Die Tests verwenden ausschließlich eine explizit angegebene lokale Datenbank mit `_test`-Suffix. Die Strava-API wird in automatisierten Tests ersetzt; ein echter GPS-Lauf muss nach dem Rollout als Produktionsprüfung folgen.
