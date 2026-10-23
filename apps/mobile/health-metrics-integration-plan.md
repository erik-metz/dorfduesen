# Health-Daten und Trainingskennzahlen: Bestandsaufnahme und Integrationsplan

Dieses Dokument beschreibt, welche Kennzahlen Dorfdüsen bereits berechnet, welche Quellen dafür heute genutzt werden und wie Strava-, manuelle und iOS/Android-Health-Daten künftig in einer gemeinsamen Health-Ansicht zusammengeführt werden sollen.

## Leitlinien

- Ein Messwert behält Quelle, Zeitpunkt, Einheit und Mess-/Schätzstatus. Health-Daten überschreiben keine manuell gepflegten Profilwerte.
- Gleiche Aktivität aus Strava und Health wird über Zeit, Distanz, Sport und Herkunft zusammengeführt statt doppelt gezählt.
- Running Load und allgemeine Bewegung bleiben unterscheidbar. Schritte, Radfahren oder Kalorien werden nicht stillschweigend in Laufkilometer umgerechnet.
- Direkt vom Gerät gemessene VO₂max und die aus Läufen geschätzte VO₂max werden separat benannt und angezeigt.
- Nur sport- und erholungsbezogene Datentypen gehören zur anfänglichen Berechtigungsanfrage. Besonders sensible Daten (z. B. Glukose, Blutdruck, Ernährung und Zyklus) brauchen erst einen konkreten Produktnutzen und eine eigene Entscheidung.
- Die Plattform-Berechtigungsdialoge steuern, welche Datentypen lesbar sind. Dorfdüsen bittet zusätzlich in verständlicher Sprache um Zustimmung zur Übertragung und Speicherung im persönlichen Konto.

## Kennzahlen- und Quellenmatrix

| Kennzahl / Bereich | Heute | Mögliche Health-Ergänzung | Integrationsregel / Anzeige |
|---|---|---|---|
| Wochenvolumen, durchschnittlich und Spitze | Strava-Läufe der letzten acht Wochen; Wochen-Buckets | Lauf-/Gehdistanz und Workout-Distanzen | Aktivitäten deduplizieren und Wochenansicht nach Sportart trennen; Health-Rohdistanz nicht zusätzlich addieren, wenn schon Teil eines Workouts |
| Längster Lauf, Laufhäufigkeit | Strava-Läufe | erkannte Lauf-Workouts samt Distanz/Dauer | Nur valide Laufaktivitäten einbeziehen; Quelle kenntlich machen |
| Akute/chronische Belastung (ACWR) | Laufkilometer der letzten sieben Tage geteilt durch Vier-Wochen-Laufwochenmittel | Health-Workouts, Dauer, Distanz und ggf. Puls | Zunächst lauf-spezifisch halten; erst später separate, nachvollziehbare sportartenübergreifende Load-Kennzahl entwickeln |
| Durchschnittlicher Laufpuls | Durchschnitt der Strava-Lauf-Pulswerte | Pulsproben während eines zugeordneten Workouts | Workout-Zuordnung und Messabdeckung berücksichtigen; Ruhe-/Tagespuls nicht als Laufpuls verwenden |
| VDOT / Trainingstempi | Strava-Laufdistanz, Zeit, Höhenmeter, Puls; manuelle VDOT-Überschreibung möglich | Health-Workouts und zugehörige Puls-/Distanzdaten | Nur ausreichend valide Läufe für Schätzung nutzen; manuelle Vorgabe bleibt sichtbar und hat Vorrang, bis Nutzer sie entfernt |
| VO₂max | Explorative Schätzung aus geeigneten Strava-Läufen, HRmax und ggf. Ruhepuls | direkt gemessene Health-VO₂max sowie Ruhe-/Belastungspuls | „Gerätemessung“ und „Laufmodell“ als zwei Reihen/Quellen anzeigen; niemals ohne Hinweis vermischen |
| HRmax und Herzfrequenzzonen | Profilwert, sonst höchster plausibler Strava-Laufpuls bzw. Fallback; Zonen daraus abgeleitet | aufgezeichneter Höchstpuls sowie Ruhepuls | Profilwert bleibt manuell; Health-Messung als beobachteter Wert mit Datum/Quelle anbieten, nicht ungefragt übernehmen |
| Ruhepuls | manuell erfasster HealthMetric und Profilwert | Health-Ruhepuls-Zeitreihe | Zeitreihe mit Herkunft/Datum; für Berechnungen robuste aktuelle Basis statt einzelner Ausreißer verwenden |
| Gewicht | manuelle HealthMetric / Profilwert | Health-Körpermasse und später ggf. Körperfett / fettfreie Masse | Messreihe erhalten; Profilgewicht nur nach expliziter Produktregel aktualisieren |
| 26-Wochen-Entwicklung | rekonstruierte Wochenpunkte aus Aktivitäten, Ruhepuls und Gewicht; keine historischen Messungen | Zeitreihen für echte Gerätewerte wie VO₂max, Ruhepuls, HRV, Gewicht und Schlaf | In der UI rekonstruierte Schätzwerte von echten historischen Messungen unterscheiden; keine rückwirkend erfundenen Health-Messungen |
| Schlaf und Erholung (neu) | keine kombinierte Auswertung | Schlafdauer/-phasen, HRV, Ruhepuls, Atemfrequenz | Als deskriptive Trends/Erholungskontext starten; keine medizinischen Aussagen und keine automatische Änderung von Trainingsplänen ohne validierte Regeln |
| Bewegung im Alltag (neu) | nicht zentrale Strava-Kennzahl | Schritte, Stehzeit, aktive Energie, Etagen | Eigener Bereich; nicht mit Lauftraining gleichsetzen |
| Körperzusammensetzung (später) | keine integrierte Reihe | Körperfett, fettfreie Masse, Körperwasser | Nur bei ausreichender Datenqualität und einheitlicher Einheit; Messgeräteabweichungen erklären |
| Weitere potenzielle Gesundheitsdaten (später) | nicht genutzt | Sauerstoffsättigung, Temperatur, Blutdruck, Glukose, Ernährung, Flüssigkeit, Zyklus | Außerhalb des ersten Sport-/Erholungsumfangs; Sensibilität, konkreten Nutzen, Berechtigung und Darstellung separat begründen |

## Aktuelle Architektur (geprüft am 23.10.2026)

- `baseline-calculation.ts` berechnet Laufhäufigkeit, Wochenkilometer, längsten Lauf, Laufpuls, ACWR und VDOT aus `Activity`-Datensätzen und Profilwerten.
- `vo2max.ts` schätzt VO₂max aus geeigneten Laufdurchschnitten; der Code nennt das Modell ausdrücklich explorativ und nicht individuell validiert.
- `history.ts` erstellt 26 rekonstruierte Wochenpunkte aus Aktivitäten sowie manuellen `HealthMetric`-Einträgen für Gewicht und Ruhepuls.
- `/api/coach/profile` lädt Aktivitäten, UserProfile und HealthMetric. Importierte `MobileHealthRecord`-Einträge sind noch nicht Teil dieser Berechnung.
- `/api/coach/metrics` speichert manuelles Gewicht und Ruhepuls und spiegelt Werte ins Profil.
- Mobile Health-Importe werden separat als Rohdatensätze mit Quellmetadaten aufbewahrt. Es gibt noch keine Deduplizierung bzw. kanonische Verknüpfung mit Strava-Aktivitäten.
- Android Health Connect liefert im derzeitigen Importfenster nur Daten der letzten 30 Tage; iOS fragt bis zu 365 Tage ab. Das muss in Datenabdeckung und UI erklärt bzw. in späteren Synchronisierungen berücksichtigt werden.

## Umsetzungsreihenfolge

1. **Bestand und Quellen dokumentieren** — abgeschlossen mit diesem Dokument.
2. **Health-Verbindung vereinfachen** — Betriebssystemberechtigungen statt App-Checkboxliste; einmaliger, überspringbarer Verbindungshinweis nach erster Strava-Anmeldung; klare Speicherzustimmung sowie Aktionen zum Trennen/Löschen — in diesem Arbeitspaket umgesetzt.
3. **Gemeinsame Health-Ansicht gestalten** — bestehende Physiologie-Kennzahlen und neue Health-Trends in klare Bereiche aufteilen; Messung, Schätzung, Quelle, Einheit und Datenabdeckung zeigen.
4. **Gemeinsame Datenbasis schaffen** — Health-Rohdaten normalisieren und Strava-/Health-Aktivitäten deduplizieren/verknüpfen, ohne Herkunft oder Rohdaten zu verlieren.
5. **Bestehende Trainingskennzahlen integrieren** — Laufvolumen, Häufigkeit, Laufpuls, ACWR, Ruhepuls, HR-Zonen, VDOT, Trainingstempi, Profilvitalwerte und 26-Wochen-Historie auf die kanonische Datenbasis umstellen.
6. **Health-Kennzahlen ergänzen** — direkte VO₂max getrennt von Modellschätzung; danach Schlaf, HRV, Alltag/Bewegung und ggf. Körperzusammensetzung mit vorsichtigen, erklärten Auswertungen.
7. **Datenqualität und Plattformverhalten prüfen** — iOS/Android-Berechtigungen, leere/teilweise Freigabe, Widerruf, Löschen, Duplikate, Zeiträume, Einheiten, Offline-/Fehlerfälle und Nutzertexte auf Geräten durchgehen.

## Umfang des Verbindungsschritts

Die App fordert für den ersten Sport-/Erholungsumfang Trainings, Schritte/Distanz, aktive Energie/Trainingszeit, Puls-/Ruhepuls-/HRV-Daten, relevante Körperwerte, direkte VO₂max, Schlaf und ausgewählte Vitaltrends an. Das Gerät entscheidet im eigenen Berechtigungsdialog, was davon zugänglich ist. Für die Übertragung und Kontospeicherung wird einmalig eine eigene, klar formulierte Zustimmung eingeholt. Ein späterer oder nicht erteilter Zugriff blockiert die übrige App nicht.
