# iOS-Veröffentlichung – Arbeitsstand

Stand: 17. November 2026. Die technische Apple-Einrichtung aus Schritt 1 ist abgeschlossen.
Der fachlich zu bestätigende Supportkontakt bleibt als offener Metadatenpunkt bestehen.

## Festgelegter Vertrieb

- Kostenlos, ausschließlich Deutschland (vom Anbieter bestätigt).
- Name: Dorfdüsen; Plattform: iOS; Hauptsprache: Deutsch.
- Bundle-ID: `de.dorfduesen.app`; interne SKU: `dorfduesen-ios`.
- Preisplan gespeichert: 0,00 Euro, Preisbasis Deutschland.
- Verfügbarkeit gespeichert und geprüft: genau ein Land, Deutschland
  (Available on App Release); die übrigen 174 Länder sind Not Available.
- Zusätzliche Verfügbarkeit auf Apple Silicon Macs und Vision Pro deaktiviert und gespeichert.
- App-Eintrag: https://appstoreconnect.apple.com/apps/6835762461/distribution/info
- Apple-ID: `6835762461`; angelegte Store-Version: `1.0`, Prepare for Submission.

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

### Im Apple-Portal abgeschlossen

- Explizite App-ID `de.dorfduesen.app` mit technischer Beschreibung `Dorfduesen`
  registriert und in der Kennungsliste bestätigt.
- HealthKit bei der Registrierung aktiviert und im erzeugten Provisioning-Profil geprüft.
- App-Eintrag mit iOS, Dorfdüsen, Deutsch, Bundle-ID und SKU erstellt und
  anschließend in App Information verifiziert.
- Distributionsprofil `Dorfduesen App Store 2026-11-17` erstellt, heruntergeladen
  und unter `~/Library/Developer/Xcode/UserData/Provisioning Profiles/` installiert.
- Profil-ID: `L44ZYZAF6B`; UUID: `6415b2b3-c6ca-4624-bfeb-090120184bba`.
- Ablaufdatum laut Profil: 14. November 2027.
- Profilprüfung: richtiges Team, richtige App-ID, HealthKit aktiv,
  `get-task-allow=false`, enthaltenes Distributionszertifikat stimmt mit der
  vorhandenen lokalen Signing-Identität überein.
- Release-Konfiguration im lokalen Xcode-Projekt auf dieses Profil und
  `Apple Distribution` mit manuellem Signing gesetzt.

### Wiederherstellung nach Expo Prebuild

Der native iOS-Ordner ist generiert und Git-ignoriert. Die Team-ID bleibt über
`app.json` erhalten. Falls Prebuild die manuelle Release-Zuordnung zurücksetzt,
vor dem Archivieren aus `apps/mobile` erneut anwenden:

```sh
node -e 'const {IOSConfig}=require("@expo/config-plugins"); IOSConfig.ProvisioningProfile.setProvisioningProfileForPbxproj(process.cwd(),{appleTeamId:"GS338K2H7M",profileName:"Dorfduesen App Store 2026-11-17",buildConfiguration:"Release",codeSignIdentity:"Apple Distribution"});'
```

Das Profil und die Signing-Schlüssel gehören nicht ins Repository. Auf einem
anderen Rechner müssen Profil und passende Signing-Identität sicher vorhanden sein.

### Noch offene Metadaten

- App-bezogenen öffentlichen Supportkontakt und Support-URL mit dem Anbieter
  festlegen; keinen Kontakt erfinden oder private Kontaktdaten ungefragt veröffentlichen.
  Dies muss mit den Datenschutz-/Supportseiten vor der Einreichung ergänzt werden.

Es wurde kein neuer Vertrag angenommen und kein Build erstellt, hochgeladen
oder zur Prüfung eingereicht. Die früheren Browserfehler wurden beim Fortsetzen
über die vom Nutzer geöffnete Developer-Seite überwunden.

## Weitere Schritte

Nach der Einrichtung anhalten und die Freigabe für Schritt 2 einholen; den noch
offenen Supportkontakt dabei transparent benennen.
Schritt 2 umfasst Kontolöschung, Datenschutz-Verlinkung und Prüfung des Strava-Logins.
Weitere Schritte: HealthKit/Datenschutzangaben, Release-Build, TestFlight und
Store-Material, anschließend Review und Veröffentlichung.
