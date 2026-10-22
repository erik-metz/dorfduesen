# Mobile Health-Daten – Implementierungsplan

## Umsetzungsstand (22.10.2026)

- Fertig: breite, vom Nutzer auswählbare Datentypen; HealthKit/Health Connect-Anbindung; Zustimmung in der App; getrennte Prisma-Tabellen; authentifizierte Status-, Einwilligungs-, Import-, Abruf- und Lösch-API; Datenbankmigration angewendet.
- Synchronisierung startet aktuell nur auf Knopfdruck. iOS liest bis zu 365 Tage, Health Connect bis zu 30 Tage (Systemgrenze ohne zusätzliche Historienberechtigung). Die Imports werden idempotent gespeichert und beeinflussen keine Strava-Arena-Wertungen.
- Noch offen: importierte Messwerte im Dashboard darstellen; vollständige inkrementelle Synchronisierung mit Provider-Cursorn und HealthKit-Löschmeldungen; Laufzeitprüfung mit echten Health-Daten auf Geräten; Datenschutz-/Store-Deklarationen finalisieren.
- Android Debug-Build ist erfolgreich. iOS-Prebuild ist erfolgreich, der CocoaPods-/iOS-Build konnte in der aktuellen Umgebung wegen fehlendem CMake und nicht erreichbarem GitHub-Hermes-Quellcode nicht abgeschlossen werden.

## Ziel

Die iOS- und Android-App sollen nach ausdrücklicher Zustimmung ausgewählte Gesundheits- und Fitnessdaten aus Apple HealthKit bzw. Android Health Connect lesen und sicher dem angemeldeten Dorfdüsen-Konto zuordnen. Relevante Daten werden über die bestehende Next.js-API in der PostgreSQL-Datenbank gespeichert und im Dashboard bzw. in der Physiologieansicht nutzbar gemacht.

Die Betriebssystemberechtigung erlaubt den Zugriff auf Gerätedaten. Sie ersetzt nicht die ausdrückliche Erklärung und Zustimmung, dass ausgewählte Daten an Dorfdüsen übertragen und auf dem Server gespeichert werden.

## Ausgangslage im Repository

- Die mobile App verwendet Expo SDK 57, Expo Router und Strava-Login. Native iOS-/Android-Projekte werden via Expo Prebuild erzeugt und nicht eingecheckt.
- Das Backend hat bereits authentifizierte Mobile-API-Routen und eine PostgreSQL-Datenbank via Prisma.
- `HealthMetric` speichert derzeit manuelle Körperdaten (`weightKg`, `restingHeartrate`, Datum, Notiz), aber keine Herkunft, externen IDs oder Rohdaten.
- `Activity` speichert Strava-Aktivitäten anhand der global eindeutigen `stravaId`. Ein Import derselben Workouts aus Health Connect/HealthKit darf keine Arena-Statistiken oder Trophäen doppelt zählen.
- Deshalb sollten native Gesundheitsimporte zunächst in getrennten, quellmarkierten Tabellen landen. Vorhandene Strava-Aktivitäten bleiben für bestehende Ranglisten und Auswertungen kanonisch.

## Empfohlener Umfang für die erste Version

1. **Workouts/Trainingseinheiten**: Typ, Start/Ende, Dauer, Distanz, Höhenmeter und Gesamtenergie, soweit verfügbar.
2. **Gewicht**: einzelne Messwerte mit Messzeit und Einheit.
3. **Ruhepuls**: Tages-/Messwerte mit Messzeit und bpm.

Herzfrequenzverläufe, Schlaf, Schritte, Blutdruck, Blutsauerstoff, Zyklusdaten, klinische Datensätze und Schreibzugriff in HealthKit/Health Connect bleiben zunächst außerhalb des Umfangs. Sie bringen zusätzliche sensible Datentypen, Berechtigungen und Produktfragen mit sich. Spätere Aufnahme eines Datentyps braucht eine eigene Begründung, Berechtigungsbeschreibung und Datenflussprüfung.

## Datenfluss

```text
HealthKit / Health Connect
        ↓ nur freigegebene Datentypen, nach Opt-in
Expo native Health-Modul
        ↓ Normalisierung, Einheiten, Deduplizierung
Dorfdüsen Mobile API (Bearer-Session)
        ↓ Benutzerzuordnung serverseitig aus Session
Prisma / PostgreSQL
        ↓ nur eigene, erlaubte Daten
Dashboard / Physiologie
```

Gesundheitsdaten werden niemals anhand einer vom Client gesendeten `userId` einem Konto zugeordnet. Der Server bestimmt den Benutzer ausschließlich aus der authentifizierten Mobile-Session.

## Schritte

### 1. Datentypen und Produktregeln festlegen — umgesetzt

- Bestätigen, dass der erste Release genau die drei oben genannten Datengruppen umfasst.
- Definieren, ob Workouts aus Apple Health/Health Connect nur angezeigt werden oder auch in Trainingspläne eingehen dürfen.
- Für die erste Version festlegen: Gesundheits-Workouts werden separat angezeigt; sie verändern weder Strava-Arena-Ranglisten noch Strava-Trophäen.
- Festlegen, wie Korrekturen und Löschungen aus der Quelle behandelt werden und wie lange importierte Daten gespeichert werden.
- Datenwörterbuch mit kanonischen Einheiten (Meter, Sekunden, Kilogramm, bpm, Kilokalorien) und Zeitzonenregeln erstellen.

**Ergebnis:** freigegebene Datenarten, Verwendungszweck und Anzeigeverhalten sind klar.

### 2. Datenmodell und Migration — umgesetzt

- `HealthMetric` um Quellenangaben erweitern oder eine separate `ImportedHealthSample`-Tabelle ergänzen. Empfehlung: separate Tabelle, damit manuelle und importierte Werte nicht verwechselt werden.
- Eigene Tabellen für importierte Samples und Workouts mit mindestens: `userId`, `source` (`APPLE_HEALTH` / `HEALTH_CONNECT`), `sourceRecordId`, `recordType`, `startAt`, `endAt`, kanonischen Messwerten, `unit`, `metadata` nur falls erforderlich und `importedAt`.
- Eindeutigkeit pro Benutzer, Quelle und Quell-ID, damit wiederholte Imports idempotent sind.
- Einwilligung/Verbindung pro Benutzer und Quelle mit Status, erteilten Datentypen, Einwilligungszeitpunkt, letzter Synchronisierung und Widerrufszeitpunkt speichern. Keine rohen Health-Provider-Tokens speichern, sofern SDKs keine benötigen.
- Indizes auf Benutzer, Quelle, Datentyp und Zeitstempel; Löschregeln und Migrations-Rollback festhalten.

**Ergebnis:** Prisma-Schema und geprüfte Migration für reproduzierbare Imports.

### 3. Native Expo-Integration vorbereiten — konfiguriert

- Eine passende native Expo-Integration auswählen oder ein lokales Expo-Modul mit iOS- und Android-Implementierung bauen. Vor einer Paketwahl SDK-57-Kompatibilität, Wartung, Lizenz und Health-API-Abdeckung verifizieren.
- Config Plugin/Expo-Modul so einrichten, dass `prebuild` HealthKit-Entitlements und erforderliche Android-Berechtigungen reproduzierbar generiert.
- Native iOS-Projekte brauchen HealthKit-Capability und präzise `NSHealthShareUsageDescription`-Texte. Android braucht die Health Connect-Bibliothek, minimale Manifest-Permissions und den Health-Connect-Verfügbarkeits-/Installationspfad.
- Integration funktioniert nur in nativen Builds/Development Builds, nicht in Expo Go. Native Ordner bleiben generiert; Konfiguration bleibt im Expo-Projekt nachvollziehbar.

**Ergebnis:** beide Plattformen bauen reproduzierbar mit Health-API-Zugriff.

### 4. Einwilligung und Verbindungsverwaltung — umgesetzt

- In der App eine verständliche Vorschaltseite zeigen: welche Daten gelesen, wofür sie genutzt, an den Server übertragen und wie lange sie gespeichert werden.
- Getrennte, optionale Schalter für Workouts, Gewicht und Ruhepuls anbieten. Keine Berechtigung beim App-Start erzwingen.
- Erst nach bewusster Aktion die Betriebssystem-Abfrage für genau die gewählten Datentypen starten.
- Zustand verständlich darstellen: nicht eingerichtet, verbunden, teilweise freigegeben, kein Zugriff/keine Daten, Synchronisierung ausstehend, Fehler, widerrufen.
- Verbindung trennen, lokale Berechtigungsverwaltung öffnen und gespeicherte Serverdaten löschen lassen. Widerruf muss auch funktionieren, wenn die Betriebssystemfreigabe außerhalb der App geändert wurde.
- Keine Annahme treffen, dass HealthKit den Lesewiderruf eindeutig meldet: Apple liefert bei verweigertem Lesezugriff keine einfache Statusauskunft. UI muss deshalb neutral bleiben und leere/fehlende Daten korrekt behandeln.

**Ergebnis:** transparente, optionale Zustimmung und verwaltbarer Widerruf.

### 5. Synchronisations-API absichern und bauen — umgesetzt

Vorgeschlagene Endpunkte unter `/api/mobile/health/`:

- `GET /status`: Verbindungsstatus, akzeptierte Datentypen, letzter erfolgreicher Import.
- `PUT /consent`: Einwilligung/Datentypen setzen oder widerrufen; nur nach App-Opt-in aufrufen.
- `POST /sync`: begrenzte, normalisierte Datensätze batchweise übertragen; serverseitig validieren, deduplizieren und der Session-Person zuordnen.
- `GET /records?type=...&from=...&to=...`: eigene gespeicherte Daten fürs Dashboard abrufen.
- `DELETE /records`: ausgewählte Gesundheitsimporte löschen; optional `DELETE /connection` für Einwilligung und Importcursor.

API-Anforderungen:

- Vorhandenes Mobile-Bearer-Auth-Verfahren verwenden, niemals Strava-Token an das Gerät geben.
- Größen-/Batchlimits, Ratenlimit, Schema-Validierung, erlaubte Datentypen und Wertebereiche.
- Strikte Ownership-Filter; keine Team- oder Arena-Endpunkte für personenbezogene Gesundheitsdaten.
- Idempotente Upserts mit eindeutigem Provider-Schlüssel; fehlerhafte Records einzeln zurückweisen und den Fehler pro Batch verständlich melden.
- Keine Gesundheitswerte in Logs, Analytics, Crash-Reports oder Fehlermeldungen schreiben.

**Ergebnis:** sicherer, nachvollziehbarer Import und Abruf für das eigene Konto.

### 6. Lokale Synchronisierung implementieren — erste Version umgesetzt

- Beim bewussten Verbinden einen initialen, begrenzten Rückblick synchronisieren; Zeitraum vorab festlegen und in der App anzeigen.
- Weitere Imports nur bei App-Nutzung bzw. manueller Aktualisierung starten. Hintergrundimport ist eine separate spätere Freigabe und braucht zusätzliche OS-Berechtigungen sowie zuverlässiges Verhalten auf iOS und Android.
- iOS: HealthKit-Abfragen mit Anker/Cursor nutzen, um neue und gelöschte Samples seit dem letzten Lauf zu erkennen.
- Android: Health Connect Paging-/Changes-Mechanismen und Changes-Tokens für Folgesynchronisierungen verwenden; Berechtigungen können auf Android standardmäßig zunächst nur Daten der letzten 30 Tage abdecken. Historischen Zugriff nicht unnötig anfordern.
- Cursor lokal sicher speichern, serverseitig nur falls für Betrieb und Fehlersuche erforderlich. Bei Neuinstallation, Cursorverlust, Widerruf oder Tokenablauf sauber neu synchronisieren.
- Daten von Strava nicht versehentlich duplizieren: Ähnlichkeitserkennung über Zeit, Sportart und Distanz darf höchstens markieren/zuordnen, aber Strava-Datensätze nicht automatisch überschreiben.

**Ergebnis:** wiederholbare, inkrementelle und begrenzte Synchronisierung.

### 7. Physiologie und Dashboard verbinden — Verbindungssteuerung umgesetzt

- Importquelle und Zeitpunkt sichtbar kennzeichnen, z. B. „Apple Health · 07:30“.
- Manuelle `HealthMetric`-Werte behalten und neben importierten Werten unterscheidbar darstellen.
- Regeln für mehrere Messungen am selben Tag: nicht stillschweigend überschreiben; in Detailansicht Herkunft und Messzeit anzeigen.
- Gesundheits-Workouts getrennt von Strava-Aktivitäten anzeigen, bis die Doppelzählungs-/Trainingsplanregeln fachlich freigegeben sind.
- Keine medizinischen Diagnosen oder Gesundheitsversprechen aus den importierten Daten ableiten.

**Ergebnis:** Nutzer verstehen Quelle und Verwendung ihrer Werte.

### 8. Datenschutz, Store-Angaben und Betrieb — Entwürfe aktualisiert

- Datenschutzerklärung, In-App-Hinweise, Apple App Privacy und Google Play Data Safety um Datentypen, Zweck, Weitergabe, Speicherdauer, Löschung und Backend-Verarbeitung ergänzen.
- HealthKit-Zwecktexte in iOS und Android-Berechtigungsdeklarationen exakt auf die implementierten Datentypen beschränken.
- Health-Connect-Zugriff und sämtliche deklarierten Datentypen in Play Console Health Apps Declaration angeben und begründen.
- Apple HealthKit-Richtlinien verbieten die Nutzung von Gesundheitsdaten für Werbung oder Verkauf an Datenbroker; Daten nur für den ausdrücklich beschriebenen Gesundheits-/Fitnesszweck verwenden.
- Backend-Löschprozess und Kontolöschung auf importierte Gesundheitsdaten ausweiten; Löschung unabhängig je Datentyp anbieten.
- Keine echten Gesundheitsdaten in Debug-Logs oder Store-Screenshots nutzen.

**Ergebnis:** App-Verhalten, Datenschutzhinweise und Store-Erklärungen stimmen überein.

### 9. Prüfung auf Simulatoren und Geräten

- Automatisiert: Normalisierung, Einheiten, ungültige Werte, Ownership, Upsert/Deduplizierung, Batchlimits und Löschungen.
- iOS: HealthKit läuft nicht vollständig im Simulator; Autorisierung und echte Samples auf einem iPhone mit Testdaten prüfen.
- Android: Health Connect Provider-Verfügbarkeit, leere Quelle, partielle Berechtigungen, 30-Tage-Grenze, Paging und Widerruf auf Emulator und Gerät prüfen.
- Ende-zu-Ende: Login → Opt-in → OS-Freigabe → Import → DB-Abruf → Anzeige → Widerruf → Löschung.
- Zusätzlich: Netzwerkfehler, App-Abbruch während Upload, doppelte Batches, Zeitzonenwechsel, Sommerzeit und Wiedereinspielen nach Neuinstallation prüfen.

**Ergebnis:** Freigabekriterien und reproduzierbare Testfälle für beide Plattformen.

## Abnahmekriterien

- Ohne explizite Zustimmung wird kein Health-Datensatz gelesen oder hochgeladen.
- Der Nutzer kann jeden unterstützten Datentyp einzeln freigeben und die Freigabe zurücknehmen.
- Alle gespeicherten Datensätze gehören serverseitig ausschließlich zum angemeldeten Konto.
- Wiederholte Synchronisierung erzeugt keine Duplikate.
- Herkunft, Einheit und Messzeit sind nachvollziehbar.
- Gesundheitsdaten beeinflussen keine bestehenden Strava-Ranglisten/Trophäen, bis eine separate Regel beschlossen ist.
- Nutzer können Health-Importe einsehen und löschen; Kontolöschung entfernt sie ebenfalls.
- API, Datenbank und Logs legen keine Gesundheitswerte anderer Benutzer offen.
- Store-Deklarationen und Datenschutztext entsprechen exakt der implementierten Datenverarbeitung.

## Offizielle Dokumentation

- [Apple: HealthKit-Zugriff autorisieren](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Apple: HealthKit konfigurieren](https://developer.apple.com/documentation/xcode/configuring-healthkit-access)
- [Apple: HealthKit-Datenschutz](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- [Android: Health Connect – Einstieg](https://developer.android.com/health-and-fitness/health-connect/get-started)
- [Android: Health Connect-Datentypen und Berechtigungen](https://developer.android.com/health-and-fitness/health-connect/data-types)
- [Expo: Native Module und Config Plugin](https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial/)
