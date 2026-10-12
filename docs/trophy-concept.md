# Vorschlag: Trophäen, die immer wieder motivieren

Alte Strava-Aktivitäten zählen weiter. Bestehende Meilensteine bleiben erhalten. Neue Regeln sind hier ein Vorschlag; dieser Katalog schaltet noch keine zusätzlichen Trophäen frei.

Das Problem ist nicht allein die Anzahl der Abzeichen: Ein einmaliger 5-km-Lauf bleibt für erfahrene Mitglieder dauerhaft erledigt. Wiederholbare Kalendererfolge schaffen jeden Monat neue Chancen, ohne die Vergangenheit abzuwerten.

## Empfohlene erste Auswahl

| Trophäe | Eindeutige Voraussetzung | Wiederholung / Stufen |
| --- | --- | --- |
| Marathon-Monat 🏅 | Ein einzelner Lauf mit mindestens 42,195 km in einem Kalendermonat | Ein weiterer erfolgreicher Monat = eine weitere Stufe; mehrere Marathons im selben Monat zählen einmal |
| Halbmarathon-Monat 🥈 | Ein einzelner Lauf mit mindestens 21,0975 km im Kalendermonat | Ein Punkt je qualifiziertem Monat; Marathon erfüllt die Schwelle ebenfalls |
| Viermal raus 🌱 | Mindestens vier verschiedene aktive Tage im Kalendermonat | Ein Punkt je qualifiziertem Monat; auch für Anfänger erreichbar |
| Achtmal aufgetaucht 🔥 | Mindestens acht verschiedene aktive Tage im Kalendermonat | Ein Punkt je qualifiziertem Monat; getrennt von Distanz und Tempo |
| Drei Monate am Ball 🗓️ | Drei aufeinanderfolgende abgeschlossene Monate mit jeweils mindestens acht aktiven Tagen | Bronze bei 3, Silber bei 6, Gold bei 12 Monaten; längste Serie bleibt erhalten |
| Jahres-Düse 🚀 | Laufkilometer im Kalenderjahr | Bronze 250 km, Silber 500 km, Gold 1.000 km, Platin 2.000 km; jedes Jahr ein neuer Eintrag |
| Radjahr 🚲 | Radkilometer ohne E-Bike im Kalenderjahr | Bronze 500 km, Silber 1.000 km, Gold 2.500 km, Platin 5.000 km; jedes Jahr ein neuer Eintrag |
| Vier Jahreszeiten 🍂 | In jedem Quartal desselben Kalenderjahres mindestens vier aktive Tage | Ein Eintrag pro vollständig qualifiziertem Jahr |
| Vorgenommen. Wieder durchgezogen. 🎯 | Vier aufeinanderfolgende Wochen mit einem rechtzeitig gesetzten und erreichten persönlichen Ziel | Bronze bei 4, Silber bei 8, Gold bei 12 Wochen; alte Aktivitäten zählen, aber fehlende historische Zielvereinbarungen werden nicht erfunden |

Zuerst die vier Monatserfolge, die Monatsserie und das Laufjahr umsetzen. Danach Radjahr, Jahreszeiten und Zielserie ergänzen. Die Distanzstufen sind Produktvorschläge, keine Trainingsempfehlungen. Marathon ist eine besondere Option, kein Standardziel für alle.

## Darstellung statt immer höherer Prozentzahl

- **Diese Woche:** aktuelle Wochenziele und Fortschritt.
- **Dieser Monat:** erreichbare Monatstrophäen, z. B. „6 von 8 aktiven Tagen“.
- **Dieses Jahr:** Jahreskilometer und Quartale.
- **Deine Sammlung:** dauerhafte Meilensteine, Stufen und historische Kalendererfolge.

Für wiederholbare Erfolge „7 erfolgreiche Monate“ oder „Gold · 2026“ anzeigen. Sie gehören nicht in einen globalen „70 % erledigt“-Zähler. Der Fortschritt beginnt für jeden neuen Zeitraum wieder bei null; historische Auszeichnungen bleiben sichtbar.

## Verbindliche Regeln vor einer Umsetzung

1. Nur gespeicherte, dem richtigen Nutzer zugeordnete Aktivitäten mit positiver Bewegungszeit zählen. Zukünftige Einträge zählen nicht.
2. Die Aktivität muss eine Distanzschwelle allein erfüllen; mehrere Läufe ersetzen keinen Marathon. Kein Tempo- oder Pulskriterium.
3. Laufen umfasst Run, TrailRun und VirtualRun. Rad folgt den bestehenden Regeln ohne E-Bike.
4. Kalendermonat und -jahr richten sich nach dem lokalen Aktivitätsdatum aus Strava. Kalenderabschlüsse laufen nach Berliner Zeit. Eine Aktivität gehört genau einem Zeitraum.
5. Monats-/Jahresdistanzziele können nach Erreichen sofort gefeiert werden. Serien werden erst nach Ende aller benötigten Monate bestätigt. Jahreszeiten erst, wenn alle vier Quartale qualifiziert sind.
6. Historische Berechnung ist idempotent: genau eine Vergabe je Nutzer, Trophäe und Zeitraum. Historische Erstberechnung sendet eine Sammelnachricht statt hunderter Einzelmeldungen.
7. Jede Freischaltung speichert Zeitraum, verwendete Regelversion und nachvollziehbare Aktivitätsbelege. Bei späterer Aktivitätskorrektur wird die Zuordnung neu geprüft.
8. Serien zählen zusammenhängende Kalenderperioden; Lücken unterbrechen sie. Geteilte Trainings an einem Tag erhöhen keine Tageszahl.

## Wochenabschluss (implementiert)

Montags um 00:05 Uhr Berliner Zeit erzeugt der bestehende Abschluss eine persönliche Nachricht für jedes zu diesem Zeitpunkt bereits vorhandene Mitglied. Alle erreichten Wochentitel werden pro Person in einer animierten Karte zusammengefasst, einschließlich geteilter Siege und persönlicher Wochenerfolge. Ohne Titel wird ein passender Abstand aus den tatsächlichen Daten berechnet: Tage zum Wochenziel, zur Routine, zum eigenen Fortschritt oder bei mindestens 80 % der Siegerdistanz die Kilometer zum geteilten Distanzsieg. Fehlende Voraussetzungen (z. B. nicht rechtzeitig gesetztes Ziel) werden berücksichtigt.

Ohne Aktivität lautet die Nachricht ehrlich „Diese Woche ist keine Aktivität gespeichert“ mit einem erreichbaren nächsten Schritt. Wiederholte Abschlussläufe erzeugen keine zweite Nachricht. Die Karte öffnet sich beim nächsten Besuch über die Glocke, lässt sich schließen und später aus Glocke oder Dashboard erneut ansehen. Reduzierte Bewegung wird respektiert. Nachträglich synchronisierte Aktivitäten verändern diesen gespeicherten Wochenrückblick nicht automatisch.
