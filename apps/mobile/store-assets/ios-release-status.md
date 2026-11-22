# iOS-Veröffentlichung – Arbeitsstand

Stand: 17. November 2026. Die technische Apple-Einrichtung aus Schritt 1 ist abgeschlossen.

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

### Metadaten

- Verantwortlicher und Kontakt für Datenschutz/Support vom Anbieter bestätigt:
  Erik Metz, Schleegasse 7, 68647 Biblis, Germany; metzmade@pm.me.
- Vorgesehene URLs: `https://dorfduesen.de/datenschutz` und
  `https://dorfduesen.de/support` (nach Deployment öffentlich prüfen).

Es wurde kein neuer Vertrag angenommen. Siehe Schritt 3 für den Build- und
Uploadstatus.

## Weitere Schritte

## Schritt 2: Kontolöschung, Datenschutz und Login-Prüfung

### Umgesetzt

- Dashboard-Aktion „Dorfdüsen-Konto löschen“ mit ausdrücklicher Warnung und Bestätigung.
- Authentifizierter Lösch-Endpunkt entfernt den Nutzer; durch die vorhandenen
  Fremdschlüssel-Kaskaden werden Sitzungen, Strava-Zugangsdaten, Aktivitäten,
  Trainings- und Gesundheitsdaten sowie weitere nutzerbezogene Datensätze gelöscht.
- Löschung versucht zusätzlich den Strava-Refresh-Token mit Stravas empfohlenem
  OAuth-Revoke-Endpunkt zu widerrufen.
- Datenschutzhinweis-Entwurf und Prüfernotizen um die technisch geprüften
  OAuth-Scopes, Sitzungsdauer und Löschaktion ergänzt.
- Apple Guideline 4.8 geprüft: sie enthält eine Ausnahme für Clients, die Nutzer
  zur Anmeldung bei einem Drittanbieterdienst benötigen, um dessen Inhalte
  abzurufen. Die Strava-Anmeldung könnte darunter fallen; wegen weiterer
  Club-, Trainings- und Health-Funktionen bleibt die konkrete Einordnung vor
  Einreichung zu bestätigen.

### Noch offen – Veröffentlichungsgate

- Öffentliche Seiten und In-App-Links ergänzt; nach Deployment die Erreichbarkeit
  dieser URLs prüfen und erst danach in App Store Connect eintragen.
- Allgemeine Anbieterregionen, Drittlandverarbeitung und tarifabhängige
  Retentionsregeln wurden anhand öffentlicher Herstellerunterlagen in den
  Datenschutzhinweisen beschrieben. Die produktiv ausgewählte Vercel-Funktions-
  und Neon-Datenbankregion ist je Projekt konfigurierbar und kann abweichen.
- Die Rechtsgrundlagen und die Offenlegung von Club-Sichtbarkeit sowie der
  optionalen Übermittlung von Trainingskennzahlen an xAI fachlich prüfen lassen.
- xAI-Angaben zur 30-tägigen Standardaufbewahrung und Zero-Data-Retention sind
  öffentlich dokumentiert; ob Zero-Data-Retention im verwendeten xAI-Team aktiv
  ist, ist nicht aus dem Quellcode ersichtlich.
- Prüferhinweise zu Sign in with Apple bleiben abhängig von der Apple-Ausnahme
  und der konkreten Review-Einschätzung.

## Schritt 3: Store-Material und Release-Build

### In App Store Connect gespeichert

- App-Name Dorfdüsen, Untertitel „Laufen. Fortschritt. Team.“ und Hauptkategorie
  Health & Fitness.
- Deutscher Werbetext, Beschreibung und Schlüsselwörter aus
  `store-listing-de.md`; Support-URL ist `https://dorfduesen.de/support`.
- Fünf iPhone-Screenshots hochgeladen. Die von Apple akzeptierten Maße der
  gewählten iPhone-Gruppe sind 1206 × 2622 Pixel; skalierte Kopien liegen in
  `screenshots/ios-6.3/`.
- App-Datenschutzangaben wurden separat veröffentlicht (siehe Schritt 2).

### Buildstatus

- Expo-Version auf `1.0`, iOS-Buildnummer auf `1` gesetzt.
- Release-Archiv `de.dorfduesen.app`, Version 1.0 (Build 1), mit Apple
  Distribution signiert und von Xcode zu App Store Connect hochgeladen.
- Stand 17. November 2026: App Store Connect zeigt den Uploadstatus
  `Processing`; TestFlight listet den Build noch nicht.
- Xcode meldete fehlende dSYM-Dateien für React, ReactNativeDependencies und
  hermesvm. Der App-Build selbst wurde angenommen.
- Für den Upload erforderliche `NSHealthUpdateUsageDescription` ergänzt. Die
  Erklärung hält fest, dass Dorfdüsen HealthKit-Daten nur liest und nichts nach
  Apple Health zurückschreibt.

- 22. November 2026: Build 15 (kompakter Kontingent-Ring im Coach, Tastatur
  schließt nach dem Senden) per Kommandozeile hochgeladen:
  `xcodebuild -exportArchive -archivePath <archiv> -exportOptionsPlist <plist>
  -allowProvisioningUpdates` mit `method` `app-store-connect` und `destination`
  `upload`. Voraussetzung ist ein gültig angemeldetes Konto unter Xcode →
  Settings → Accounts; ein beschädigter Schlüsselbundeintrag führt zu
  „Failed to Use Accounts“.
- 22. November 2026: Build 17 mit `expo-updates` archiviert (Fingerprint `91f81341…`, passt zum
  ersten EAS-Update). Kommandozeilen-Upload scheiterte erneut an „Failed to Use Accounts“;
  Upload per Organizer oder künftig per App-Store-Connect-API-Key. Build 16 (mit inzwischen
  entfernter Update-Signatur) nicht verwenden.
- Apple-Hinweis: Ab April 2027 sind Uploads nur noch mit dem iOS-27-SDK
  (Xcode 27) möglich.

### Noch offen vor einer Prüfungseinreichung

- HealthKit-App-Compliance: Apples Erklärung, ob Dorfdüsen ein reguliertes
  Medizinprodukt ist, wurde nicht abgegeben.
- Altersfreigabe-Fragebogen, Review-Kontakt/Anmeldeinformationen und weitere
  erforderliche App-Compliance-Angaben sind noch zu bearbeiten.
- Build-Verarbeitung abwarten und Version 1.0 den Store-Metadaten zuordnen.
- Es wurde nicht auf „Add for Review“ geklickt; die App wurde nicht zur Prüfung
  eingereicht.

Nächster Schritt: App-Compliance und Altersfreigabe vervollständigen, danach den
verarbeiteten Build prüfen und die Einreichung vorbereiten.
