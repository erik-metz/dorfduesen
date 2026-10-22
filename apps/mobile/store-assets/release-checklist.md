# Store-Einreichung – Checkliste

## Identität und Store-Konten

- [ ] Rechtlichen Entwickler-/Anbieternamen und Supportkontakt bestätigen.
- [ ] Apple Developer- und Google Play Console-Konten sowie Vereinbarungen abschließen.
- [ ] Bundle-ID `de.dorfduesen.app` und Android-Paket `de.dorfduesen.app` im jeweiligen Konto prüfen.
- [ ] App-Name, Beschreibung, Kategorie, Altersfreigabe, Export-/Verschlüsselungsfragen und Inhaltsangaben im Portal ausfüllen.
- [ ] Support- und Datenschutz-URL öffentlich erreichbar bereitstellen.

## App und Zugang

- [ ] Produktions-OAuth-Konfiguration, Redirect-URLs, Datenschutz und Fehlerbehandlung prüfen.
- [ ] Kontolöschung in der App und erforderliche externe Lösch-URL implementieren und Ende-zu-Ende prüfen.
- [ ] Strava-Datenumfang, Berechtigungen, Widerruf, Synchronisierung und Löschung erklären.
- [ ] Prüferkonto erstellen, sicher über das Store-Portal hinterlegen und dauerhaft funktionsfähig halten.
- [ ] Finale iOS- und Android-Builds auf echten Geräten prüfen, einschließlich Anmeldung, Abmeldung, Deep Links, Offline-/Fehlerzuständen, Layout, Barrierefreiheit und Push-Mitteilungen (falls genutzt).
- [ ] Aktuelle Build-/SDK-/Store-Anforderungen unmittelbar vor Upload anhand der offiziellen Portale prüfen.

## Store-Material

- [x] Android: fünf echte Emulatoraufnahmen erstellt; sichtbare Profilnamen, Profilbilder und Strava-Athleten-ID unkenntlich gemacht.
- [x] iOS: fünf echte Inhaltsansichten plus Anmeldeseite im iPhone-17-Pro-Max-Simulator aufgenommen; sichtbare Team-/Profilnamen, Profilbilder, Strava-Athleten-ID und Arena-Champion-Name unkenntlich gemacht.
- [ ] Alle Screenshots mit genehmigten Testdaten erstellen; keine fremden privaten Strava-Daten zeigen.
- [ ] Arena-/Ranglistenmaterial erst nach bestätigter Strava-API-Freigabe verwenden.
- [ ] Texte gegen ausgelieferte Funktionen abgleichen und Zeichenlimits im Portal prüfen.
- [ ] App-Icon und Google-Play-Feature-Grafik auf Lesbarkeit in kleinen Größen prüfen.
- [ ] Datenschutzrichtlinie vervollständigen und vom Verantwortlichen freigeben lassen.
- [ ] HealthKit-/Health-Connect-Datenarten und Serverübertragung in Apple App Privacy und Google Play Data Safety korrekt deklarieren; Google Play Health-Apps-Erklärung und Datentyp-Freigabe ausfüllen.
- [ ] HealthKit-Zwecktexte und Health-Connect-Manifestberechtigungen gegen die endgültig verwendeten Datentypen und Store-Freigaben abgleichen.

## Store-Prüfung und Veröffentlichung

- [ ] Review Notes und dedizierte Zugangsdaten im Portal hinterlegen.
- [ ] Datenschutzdeklarationen (Apple App Privacy, Google Data safety) mit echten Datenflüssen abgleichen.
- [ ] TestFlight und Google Play-Testtrack durchlaufen.
- [ ] Version, Buildnummer, Release Notes und stufenweise Veröffentlichung festlegen.
- [ ] Store-Listings final prüfen; Einreichung erst nach Freigabe der offenen Punkte.
