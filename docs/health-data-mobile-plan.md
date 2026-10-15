# Mobile Health-Sync für DorfDüsen – Implementierungsplan

**Status:** Geplant

**Zuletzt aktualisiert:** 15.10.2026

**Ziel:** Mitglieder können auf iPhone und Android die verfügbaren Gesundheits- und Fitnessdaten freigeben. Eine Begleit-App synchronisiert neue Daten möglichst automatisch an die DorfDüsen-Infrastruktur. Die Website zeigt Verbindungs- und Sync-Status; Auswertungen können anschließend darauf aufbauen.

> **Fortschritt laufend dokumentieren:** Sobald ein Schritt begonnen wird, ist er in der Statusübersicht auf `In Arbeit` zu setzen und mit Datum, zuständiger Person, nächstem konkreten Arbeitsschritt und bekannten Blockern zu versehen. Bei Arbeit über mehrere Tage wird der Eintrag bei jedem wesentlichen Meilenstein aktualisiert, damit der tatsächliche Implementierungsstand sichtbar bleibt. Beim Abschluss wird der Schritt als `Erledigt` markiert und ein kurzer Ergebnis-/Nachweisvermerk ergänzt. Entscheidungen, die einen späteren Schritt ändern, werden ebenfalls hier festgehalten.

## Fortschritt

| Schritt | Status | Zuletzt aktualisiert | Zuständig | Nächster Schritt / Ergebnis / Blocker |
| --- | --- | --- | --- | --- |
| 0. Open-Wearables-Technikprüfung | Geplant | – | – | SDK und selbst gehostetes Backend mit je einem iPhone und Android-Gerät als Spike prüfen |
| 1. Umfang, Datenmodell und Datenschutz festlegen | Geplant | – | – | Unterstützte Datentypen, Aufbewahrung und Sichtbarkeit entscheiden |
| 2. Zielarchitektur und Open-Wearables-Entscheidung | Geplant | – | – | Ergebnis aus Schritt 0 bewerten und Architekturentscheidung dokumentieren |
| 3. Backend-Identität, API und Persistenz | Geplant | – | – | Authentifizierte Kopplung, Ingestion und Idempotenz implementieren |
| 4. Expo-Begleit-App | Geplant | – | – | iOS-/Android-App, Health-Berechtigungen und Statusoberfläche bauen |
| 5. Synchronisation und Datenimport | Geplant | – | – | Erstimport, inkrementelle Läufe, Wiederaufnahme und Löschungen umsetzen |
| 6. Website-Ansicht und Kontrollen | Geplant | – | – | Verbindung, letzte Syncs, Datenauswahl und Löschen/Trennen anzeigen |
| 7. Geräteprüfung, Veröffentlichung und Betrieb | Geplant | – | – | Reale Geräte, Store-Angaben, Monitoring und Rollout vorbereiten |

Statuswerte: `Geplant`, `In Arbeit`, `Blockiert`, `Erledigt`. Bei `Blockiert` den konkreten Grund und die zur Auflösung nötige Aktion angeben.

## Recherche: Open Wearables

[Open Wearables](https://github.com/the-momentum/open-wearables) passt grundsätzlich gut zum Vorhaben: Es ist eine MIT-lizenzierte, selbst hostbare Plattform mit einer normalisierten API, Webhooks und Daten aus Cloud-Anbietern. Apple Health, Samsung Health und Health Connect sind SDK-basierte Quellen; Garmin, Oura, Whoop, Polar, Suunto und weitere werden als Cloud-Integrationen aufgeführt. Die Dokumentation beschreibt Zeitreihen, Workouts, Schlaf und tägliche Zusammenfassungen. Die konkrete Abdeckung ist je Quelle unterschiedlich und muss gegen unsere benötigten Werte geprüft werden. [Coverage Matrix](https://openwearables.io/docs/providers/coverage)

Es gibt ein offizielles [React-Native-SDK](https://github.com/the-momentum/open-wearables-react-native-sdk), das auf der Expo Modules API basiert und damit für eine Expo-App interessant ist. Der Quellcode steht unter MIT. Die App würde HealthKit auf iOS und Health Connect beziehungsweise Samsung Health auf Android nutzen und Daten mit dem Open-Wearables-Backend synchronisieren.

**Wichtige Einschränkungen, die vor einer Festlegung praktisch geprüft werden müssen:**

- Das React-Native-SDK ist laut Repository derzeit noch nicht regulär auf npm veröffentlicht. Die dokumentierte Installation erfolgt aus dem Quellcode.
- Die Android-SDK-Abhängigkeit wird derzeit über `mavenLocal` eingebunden; das erschwert reproduzierbare CI- und Release-Builds.
- Das SDK dokumentiert Plattformunterschiede: iOS ignoriert eine anpassbare Sync-URL; Android kann sie verwenden. Beide Plattformen erwarten das Open-Wearables-Backend. Die native Synchronisation direkt an die bestehende DorfDüsen-API zu richten, ist daher nicht ohne Weiteres gegeben.
- Ein selbst gehostetes Open-Wearables-Backend bringt einen eigenen FastAPI-/PostgreSQL-/Redis-/Celery-Stack mit. Das wäre ein zusätzlicher Dienst, der betrieben, aktualisiert, gesichert und überwacht werden muss. Open Wearables weist außerdem auf anonymisierte Telemetrie hin; vor einem Einsatz sind deren Konfiguration und die Datenschutzdokumentation zu prüfen.
- Das Projekt bezeichnet sich als aktiv in Entwicklung; APIs können sich vor Version 1.0 ändern. Für Produktivbetrieb sind stabile, gepinnte Versionen und ein Upgrade-Prozess nötig.
- Open Wearables hat außerdem eine eigene Mobile-App für Selbsthosting/Einzelpersonen. Sie kann im Spike als schneller Ende-zu-Ende-Demonstrator geprüft werden. Für eine DorfDüsen-App mit eigener Mitgliederanmeldung ist laut SDK-Dokumentation der Backend-Tokenfluss vorgesehen; Einladungs-Codes sind kein gleichwertiger Produktionsfluss für eine Mehrnutzer-App.

**Vorläufige Empfehlung:** Open Wearables zuerst als Integrations-Spike prüfen, nicht sofort Code kopieren oder als festes Produktionsfundament einbauen. MIT erlaubt grundsätzlich auch kommerzielle Nutzung und Änderungen; bei Übernahme von Code müssen Lizenzhinweise erhalten bleiben. Zunächst ist aber zu klären, ob die aktuelle SDK-/Backend-Kombination unsere Anforderungen auf beiden Plattformen zuverlässig erfüllt und ob der zusätzliche Betriebsstack akzeptabel ist. Falls nicht, vergleichen wir eine direkte HealthKit-/Health-Connect-Anbindung in Expo mit dem Open-Wearables-SDK.

## Bestehende DorfDüsen-Anknüpfungspunkte

- Die Anwendung ist eine Next.js-Web-App; in `package.json` gibt es noch keine React-Native-/Expo-App.
- Die Anmeldung in `lib/auth/session.ts` basiert auf einer signierten HTTP-only Web-Session. Die aktuelle Sitzung lässt sich nicht als mobile Bearer-Authentifizierung verwenden.
- `User` ist in `prisma/schema.prisma` über `stravaAthleteId` an Strava gekoppelt.
- `HealthMetric` speichert derzeit nur Datum, Gewicht, Ruhepuls und Freitext. Es ist kein Modell für viele zeitgestempelte Messwerte.
- `Activity.stravaId` ist eindeutig und Aktivitäten/Trainingsauswertung referenzieren Strava-Aktivitäten. Health- oder andere Quellen passen nicht direkt in dieses Modell.

Das spricht für eine explizite Verknüpfung zwischen DorfDüsen-Mitglied und Open-Wearables-User (oder direkter Health-Integration) sowie für ein quellneutrales Datenmodell. Bestehende Strava-IDs und OAuth-Verbindungen sollten dadurch nicht ersetzt werden.

## Zielbild

1. Mitglied meldet sich in der mobilen App mit seinem bestehenden DorfDüsen-Konto an oder koppelt die App aus der Website heraus.
2. Die App erklärt Datenumfang und Zweck, lässt die gewünschten Kategorien wählen und fordert anschließend die jeweils benötigten Systemberechtigungen an.
3. HealthKit beziehungsweise Health Connect liefert die lokal verfügbaren Daten; die App überträgt sie über eine abgesicherte, wiederholbare Synchronisation.
4. Ein Backend ordnet Daten eindeutig dem DorfDüsen-Mitglied und der Quelle zu, dedupliziert Wiederholungen und protokolliert den Sync-Stand.
5. Das Mitglied sieht in der Website und App den Verbindungsstatus, die erlaubten Datentypen, den letzten erfolgreichen Sync sowie Funktionen zum Trennen und Löschen.

„Alle Health-Daten“ bedeutet im Plan: alle von den Plattformen und Geräten bereitgestellten, von Open Wearables unterstützten und von der Person ausdrücklich freigegebenen Kategorien, soweit diese im vereinbarten Produktumfang liegen. Es bedeutet nicht, dass jedes Gerät alle Typen liefert oder dass überall dieselbe Auflösung/Historie vorhanden ist. Der tatsächliche Umfang wird im Spike anhand einer Abdeckungsmatrix festgehalten.

## Implementierungsschritte

### 0. Open-Wearables-Technikprüfung

**Ziel:** Mit realen Geräten entscheiden, ob Open Wearables übernommen, angepasst oder nur als Referenz genutzt wird.

- Repo, aktuelle Releases, Changelog, Lizenz, Sicherheits-/Datenschutzangaben und Installationsweg prüfen; feste Revisionen und Versionen notieren.
- Open-Wearables-Backend isoliert lokal oder in einer Testumgebung starten; Telemetrie-Einstellung und benötigte Ressourcen dokumentieren.
- React-Native-SDK mit einer kleinen Expo-Test-App bauen. Keine Health-Daten produktiver Mitglieder verwenden.
- Auf einem iPhone HealthKit-Berechtigungen für repräsentative Typen erteilen, Erstimport starten, Datenempfang und iOS-Hintergrundverhalten beobachten.
- Auf einem Android-Gerät Health Connect-Berechtigungen, Quelle (z. B. Wear-OS-Hersteller-App) und Sync prüfen; Samsung Health separat prüfen, falls relevant.
- Verhalten mit geschlossen/terminiertem App-Prozess, fehlender Verbindung, widerrufener Berechtigung, erneutem Login und erneuter Übertragung protokollieren.
- Verifizieren, wie Nutzeridentität, Token-Erneuerung, Sync-Status, Duplikate, Backfill, Korrekturen und Löschungen funktionieren.
- Prüfen, ob iOS- und Android-SDKs als reproduzierbare CI-/EAS-Builds gebaut werden können und ob der derzeitige `mavenLocal`-Schritt sauber lösbar ist.
- End-to-end den Datenweg Open Wearables → Webhook/API → DorfDüsen-Mitglied testen; klären, ob wir Daten in unser Prisma-Modell importieren oder die Open-Wearables-API bei Bedarf abfragen.

**Abschlusskriterium:** Ein kurzes Ergebnis in dieser Datei mit getesteten Versionen/Geräten, tatsächlich eintreffenden Datentypen und Plattformunterschieden, Betriebsaufwand sowie einer Entscheidung: (A) Open Wearables hosten und integrieren, (B) SDK/Backend forkieren/anpassen oder (C) direkte HealthKit-/Health-Connect-Integration bauen.

### 1. Umfang, Datenmodell und Datenschutz festlegen

- Datenkatalog erstellen: Datentyp, Einheit, Auflösung (Tageswert oder zeitgestützte Samples), Quelle, Aufbewahrung, Darstellung und Nutzerzweck.
- Kategorien mit hohem Risiko – z. B. Reproduktionsdaten, Blutdruck, Blutzucker oder klinische Daten – nur aufnehmen, wenn ein klarer Zweck und ein genehmigter Bedarf bestehen.
- Festlegen, ob DorfDüsen rohe Zeitreihen oder aggregierte Werte speichert. Puls-Samples können sehr umfangreich werden; Auflösung und Historie beeinflussen Datenbankgröße und Zugriffsrisiko.
- Mitgliedersichtbarkeit definieren: Gesundheitswerte grundsätzlich privat; nur nach expliziter Produktentscheidung in Ranglisten, Arena oder Community-Ansichten verwenden.
- Aufbewahrungs- und Löschregeln für Rohdaten, Aggregate, Sync-Logs und entkoppelte Nutzer festlegen.
- Vor einem Vereins-Rollout Datenschutzprüfung/Datenschutzhinweise und erforderliche Rechtsgrundlage mit zuständiger Stelle klären; keine Store- oder Rechtsfreigabe vorwegnehmen.

**Abschlusskriterium:** Abgenommene Datentyp-/Zweck-Matrix, Sichtbarkeitsregeln, Retention-/Löschkonzept und technische Einwilligungsflüsse.

### 2. Zielarchitektur und Open-Wearables-Entscheidung

Auf Basis von Schritt 0 eine Architektur festschreiben:

- **Open-Wearables bevorzugt, falls Spike erfolgreich:** Open Wearables als separaten, selbst gehosteten Health-Ingestion-Dienst betreiben. DorfDüsen bleibt Identitäts- und Produktoberfläche; eine geschützte Zuordnungstabelle verbindet interne `userId` mit der Open-Wearables-User-ID. Das DorfDüsen-Backend erstellt kurzlebige, nutzergebundene SDK-Tokens; das App-Secret bleibt ausschließlich im Backend. Der Sync darf niemals allein durch eine vom Client frei gelieferte `userId` autorisiert werden. Daten gelangen via signiertem Webhook oder authentifiziertem API-Abruf in eine klar definierte DorfDüsen-Projektion.
- **Direkte Integration als Alternative:** Expo-App liest HealthKit/Health Connect über gepflegte native Module und sendet normalisierte Batches an Next.js-API-Routen. Dadurch entfällt der zweite Backend-Stack, dafür übernimmt DorfDüsen Sync-Logik, Plattformunterschiede und Providerpflege selbst.
- **Anpassung/Fork des SDK:** nur wählen, wenn die Bibliotheksprüfung zeigt, dass ein eigener Ingestion-Endpunkt nötig und mit vertretbarem Aufwand auf beiden Plattformen wartbar ist. iOS-Sync-URL-Verhalten sowie Android-Maven-Abhängigkeit sind dabei explizite Arbeitspakete.
- Garmin/Oura/andere Cloud-Provider können je nach Open-Wearables-Abdeckung direkt über den selbst gehosteten Dienst laufen. Eine HealthKit-/Health-Connect-Verbindung bleibt wichtig für Datenquellen, die nur lokal auf dem Gerät verfügbar sind.

**Abschlusskriterium:** Architekturdiagramm/Sequenz und schriftliche Entscheidung inklusive Betriebskosten, Datenhaltung, Backup, Monitoring, Releaseweg und Upgradeverantwortung.

### 3. Backend-Identität, API und Persistenz

- Mobile Kopplung an bestehendes DorfDüsen-Konto definieren. Bevorzugt kurzlebiger Einmalcode/QR aus der angemeldeten Website, der gegen ein widerrufbares, begrenzt berechtigtes Mobile-Token eingelöst wird.
- Token sicher speichern (iOS Keychain / Android Keystore via passende Secure-Storage-Lösung), rotieren und widerrufen; keine langfristigen API-Schlüssel in der App ausliefern.
- Health-Sync-Endpunkte für Ingestion/Status/Kopplung und Datenlöschung ergänzen oder sichere Webhook-Verarbeitung einrichten. Requests authentifizieren, validieren, begrenzen und Größen-/Typgrenzen setzen.
- Quellneutrales Modell entwerfen, mindestens für Nutzer, Quelle, Typ, Einheit, Messzeitpunkt/-intervall, Wert bzw. Payload, externe Sample-ID und Sync-Metadaten. Eindeutige Idempotenzschlüssel definieren.
- Zeitstempel mit UTC und Original-Zeitzonenoffset speichern; Tagesaggregate und lokale Tagesgrenzen eindeutig festlegen.
- Aktivitäten nicht mit erfundenen Strava-IDs speichern. Wenn Health-Workouts in bestehende Arena-/Trainingslogik eingehen sollen, zuerst Quell-IDs und Deduplizierungsregeln zwischen Strava und Health-Import festlegen.
- Migrationen und API-Verträge rückwärtskompatibel planen; private Messwerte niemals in öffentliche Clubabfragen aufnehmen.

**Abschlusskriterium:** Authentifizierter Testnutzer kann sicher koppeln, Daten idempotent einreichen, Sync-Status abrufen und Zugriff widerrufen; Datenmodell und Migration sind dokumentiert.

### 4. Expo-Begleit-App

- Neue App im Repository als `apps/mobile` (oder als eigenes Repository, falls EAS/CI oder Releasezugriff es erfordern) aufsetzen. Expo Go ist für HealthKit-/Health-Connect-Nativcode nicht ausreichend; native Development- und Store-Builds einplanen.
- Erst nach Entscheidung aus Schritt 2 das Open-Wearables-RN-SDK oder direkte Health-Module integrieren. Wrapper hinter `HealthProvider`/`SyncProvider` halten, damit ein Anbieterwechsel machbar bleibt.
- Onboarding: DorfDüsen-Konto koppeln, Zweck erklären, Datentypen einzeln auswählen, Systemdialog für Berechtigungen starten, Quellen und erlaubte Typen anzeigen.
- Einstellungen: letzte Synchronisation, laufender Erstimport, Sync-Intervalle soweit vom Betriebssystem unterstützt, manuelle Synchronisation, Fehler/Wiederholung, Abmeldung und Löschen.
- Keine irreführende Einstellung „exakt täglich um …“ anbieten, wenn iOS/Android die Ausführung nicht garantieren. Intervall als Wunsch-/Mindestintervall und letzten tatsächlichen Lauf transparent darstellen.
- Berechtigungen bei jedem Zugriff erneut prüfen und bei Widerruf verständlich reagieren.

**Abschlusskriterium:** installierbarer iOS- und Android-Entwicklungsbuild, klare Berechtigungsstrecke, Geräte-/Datentypanzeige und Backend-Anmeldung.

### 5. Synchronisation und Datenimport

- Erstimport mit klarer, begrenzter Historie und Fortschrittsstatus; Limits der jeweiligen Plattform/Schnittstelle berücksichtigen.
- Inkrementellen Sync nach Datenänderungen verwenden, falls SDK/API dies stabil unterstützt; bei Bedarf überlappendes Zeitfenster mit serverseitiger Deduplizierung nutzen.
- Batches lokal puffern und nach Offline-Zeit, Serverfehlern oder App-Unterbrechung wiederholen; Uploads müssen idempotent sein.
- Hintergrundsync auf iOS über HealthKit-/Betriebssystemmechanismen und auf Android über passende Health-Connect-/WorkManager-Mechanismen integrieren. Vordergrundsync bei App-Start/Öffnen bleibt Fallback.
- Nutzerseitig auswählbare Frequenz nur so weit anbieten, wie die nativen Plattformen sie unterstützen. iOS steuert den Hintergrundzeitpunkt weitgehend selbst; Android WorkManager ist ebenfalls nicht minutengenau.
- Updates, Quellkorrekturen und Löschungen verarbeiten; Verhalten pro SDK in Schritt 0 bestätigen. Ein HealthKit-Anchor-/Health-Connect-Changes-Cursor oder Open-Wearables-Sync-Cursor muss dauerhaft und migrationssicher behandelt werden.
- Logs dürfen keine Messwerte oder Tokens enthalten. Fehler- und Sync-Metriken nach Mitglied/Quelle/Batchstatus beobachten, mit restriktiven Aufbewahrungsfristen.

**Abschlusskriterium:** Erstimport, inkrementeller Lauf, Offline-Wiederholung, Duplikatvermeidung, Berechtigungswiderruf und Löschung funktionieren auf echten Geräten.

### 6. Website-Ansicht und Kontrollen

- Einstellungsseite zeigt gekoppelte Quelle(n), erteilte Kategorien (soweit erkennbar), letzte erfolgreiche Synchronisation und Sync-Fehler.
- Aktionen: Verbindung trennen, Synchronisation pausieren, importierte Health-Daten löschen, Berechtigungen erneut öffnen.
- Persönliche Health-Ansicht nur für die betroffene Person und berechtigte Rollen; keine stillschweigende Freigabe an andere Mitglieder.
- Zuerst einfache Verlaufsgrafiken/Tabellen für ausgewählte Werte. Club-Ranglisten/Badges aus Health-Daten separat entscheiden und opt-in- sowie Manipulationsregeln definieren.

**Abschlusskriterium:** Nutzer kann Verbindung und Daten in der bestehenden Website nachvollziehen und kontrollieren; kein Health-Wert erscheint unbeabsichtigt in Club- oder öffentlichen Ansichten.

### 7. Geräteprüfung, Veröffentlichung und Betrieb

- Matrix mit echten Geräten erstellen: iPhone/Apple Watch, Android-Telefon mit Health Connect, mindestens eine Wear-OS-/Samsung-Quelle und – falls im Umfang – Garmin Connect.
- Pro Typ Datenquelle, Berechtigungsstatus, Wertebereich, Auflösung, Verzögerung, Historiengrenze, Löschung und Duplikatrisiko dokumentieren.
- Releasebuilds über EAS oder festgelegten nativen CI-Prozess bauen; Signierung, Bundle IDs, HealthKit-Entitlement, Android Health Connect-Deklarationen und Store-Datenschutzerklärungen vorbereiten.
- App-Store-/Play-Store-Angaben zu Gesundheitsdaten, Nutzungszweck, Datenschutz und Datenlöschung prüfen; Plattformfreigaben und notwendige Deklarationen erledigen.
- Betriebsrunbook: DB-Backup/Restore, Open-Wearables-Upgrade (falls gewählt), API-/Webhook-Geheimnisse rotieren, Syncfehler überwachen, Nutzerlöschung aus allen Speichern und Vorfallprozess.
- Rollout stufenweise: interne Testkonten, kleine freiwillige Pilotgruppe, dann Vereinsfreigabe nach Auswertung der Datenqualität und Supportfälle.

**Abschlusskriterium:** Release-fähige Builds, geprüfte Datenschutz- und Store-Angaben, funktionierendes Backup/Löschung/Monitoring und dokumentierter Pilotentscheid.

## Nichtfunktionale Anforderungen und Risiken

- **Keine Exaktheit bei Hintergrundintervallen:** mobile Betriebssysteme können tägliche/exakte Ausführung nicht garantieren; sichtbarer Syncstatus und Vordergrund-Fallback sind erforderlich.
- **Datenvollständigkeit:** Health-Plattformen enthalten nur Daten, die Geräte/Hersteller tatsächlich dorthin geschrieben haben. Open-Wearables-Coverage ist eine Implementierungsübersicht, keine Garantie für jedes Modell.
- **Dubletten und Mehrfachquellen:** Apple Health/Health Connect aggregieren Daten unterschiedlicher Anbieter. Gerätepriorität und Quellenidentität müssen erhalten bleiben; Schritte nicht nochmals summieren, wenn Aggregat bereits Quellen zusammenfasst.
- **Datenmenge:** hochfrequente Herzfrequenz-/Zeitreihen können stark wachsen. Speicherung, Abfrageindizes, Aufbewahrung und Export/Löschung vor breiter Aktivierung planen.
- **Lizenz und Lieferkette:** Open Wearables und das React-Native-SDK nennen MIT. Lizenztexte, verwendete Abhängigkeiten, Sicherheitslage, Releases und SDK-Änderungen vor Codeübernahme prüfen.
- **Betriebsaufwand:** ein separater Open-Wearables-Stack kann schneller Providerabdeckung liefern, erhöht aber Betrieb und Datenschutz-Oberfläche. Diese Kosten gehören zur Architekturentscheidung.
- **Keine medizinische Verwendung:** Club-Fitnessdarstellung und Trainingsunterstützung klar von Diagnose/Behandlung abgrenzen; gesundheitsbezogene Aussagen und Zweckänderungen separat prüfen.

## Technische Prüfungen und Abnahme

Die Arbeitsschritte sollen jeweils mit passenden automatisierten Prüfungen ergänzt werden. Für die mobile Health-Anbindung sind zusätzlich echte Geräte erforderlich; Simulatoren allein belegen weder Berechtigungen, Wearable-Datenabdeckung noch Hintergrundsync.

- Unit-/Integrationstests: Payload-Validierung, Einheiten, Zeitzonen, Idempotenz, Nutzerisolation, Token-Widerruf, Löschung und Webhook-Signatur.
- End-to-end: Website-Kopplung → Mobile-Berechtigung → Health-Datenimport → Backend-Speicherung → Website-Anzeige → Trennen/Löschen.
- Plattformfälle: Erstimport, Wiederholung, Offline, App beendet, App erneut geöffnet, Berechtigung widerrufen, Gerät ohne unterstützte Quelle, Sommerzeitwechsel.
- Vor Freigabe Datenbank- und API-Last anhand erwarteter Zahl von Mitgliedern und Sample-Auflösung abschätzen.

## Referenzen

- [Open Wearables Repository und Haupt-README](https://github.com/the-momentum/open-wearables)
- [Open Wearables React-Native-SDK](https://github.com/the-momentum/open-wearables-react-native-sdk)
- [Open Wearables Provider-Coverage-Matrix](https://openwearables.io/docs/providers/coverage)
- [Open Wearables Mobile SDK-Dokumentation](https://openwearables.io/docs/sdk)
- [Apple HealthKit-Berechtigungen](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Android Health Connect – Einstieg und Berechtigungen](https://developer.android.com/health-and-fitness/health-connect/get-started)
- [Expo Background Tasks und Plattformgrenzen](https://docs.expo.dev/versions/latest/sdk/background-task/)
