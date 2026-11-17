# iOS-Veröffentlichung – Arbeitsstand

Stand: 17. November 2026. Schritt 1 ist noch nicht vollständig abgeschlossen.

## Festgelegter Vertrieb

- Kostenlos, ausschließlich Deutschland (vom Anbieter bestätigt).
- Name: Dorfdüsen; Plattform: iOS; geplante Hauptsprache: Deutsch.
- Bundle-ID: `de.dorfduesen.app`; interne SKU: `dorfduesen-ios`.
- Preis und Länder sind noch nicht in App Store Connect gespeichert.

## Schritt 1: Konto, App-Identität und Signing

### Geprüft und lokal eingerichtet

- Apple Developer Program: Einzelkonto Erik Metz, Team-ID `GS338K2H7M`.
- Mitgliedschaft: angezeigtes Verlängerungsdatum 9. November 2027.
- Developer Program License Agreement bereits am 8. November 2026 angenommen.
- Free Apps Agreement aktiv, angezeigte Laufzeit 8. November 2026 bis 8. November 2027.
- DSA-Bereich meldet Active und vollständig erfüllte regulatorische Anforderungen.
  Die bestehende Erklärung wurde nicht geändert.
- Gültige Apple-Development- und Apple-Distribution-Signing-Identitäten lokal vorhanden.
- Team-ID in `app.json` hinterlegt und auf das lokale native Projekt angewendet.
- Release-Build-Einstellungen mit `xcodebuild -showBuildSettings` geprüft:
  Team `GS338K2H7M`, Bundle-ID `de.dorfduesen.app`, SDK `iphoneos26.5` und
  HealthKit-Entitlement-Datei `Dorfdsen/Dorfdsen.entitlements`.
- Expo-Konfiguration erfolgreich gelesen; `git diff --check` ohne Fehler.

### Noch offen

- Explizite App-ID `de.dorfduesen.app` im Developer-Portal registrieren.
  Die geprüfte Liste enthielt nur die bestehende FurBooker-App-ID.
- HealthKit für diese neue App-ID im Portal aktivieren und die benötigte
  Provisionierung prüfen. Das lokale Entitlement allein belegt keine Portalaktivierung.
- App-Eintrag speichern. Das New-App-Formular enthält iOS, Dorfdüsen und
  `dorfduesen-ios`; Sprache und Bundle-ID sind noch nicht ausgewählt.
  Formulardaten sind kein gespeicherter App-Eintrag und können verloren gehen.
- Preis kostenlos und Verfügbarkeit ausschließlich Deutschland speichern.
- App-bezogenen Supportkontakt festlegen; hierfür keinen Kontakt erfinden.

### Technischer Blocker

Die native Brave-Steuerung liefert teilweise einen lesbaren Accessibility-Baum,
zeigt aber eine leere Seitenfläche. Auswahllisten lassen sich nicht zuverlässig
bedienen; Koordinatenklicks scheitern mit `noWindowsAvailable`.
Neuverbinden, direkter Neuaufruf und Wiederherstellen des Fensters lösten das nicht.
Der Browserzugriff meldet außerdem `The browser access host is unavailable`.

Es wurde kein App-Eintrag gespeichert, kein neuer Vertrag angenommen, kein
Provisioning-Profil erstellt und kein Build hochgeladen oder eingereicht.

## Weitere Schritte

Nach Abschluss von Schritt 1 anhalten und die Freigabe für Schritt 2 einholen.
Schritt 2 umfasst Kontolöschung, Datenschutz-Verlinkung und Prüfung des Strava-Logins.
Weitere Schritte: HealthKit/Datenschutzangaben, Release-Build, TestFlight und
Store-Material, anschließend Review und Veröffentlichung.
