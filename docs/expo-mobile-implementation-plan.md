# Expo-App für iOS und Android – Implementierungsplan

## Ziel

Eine Expo-App im Repository für iOS und Android, die die angemeldeten Dorfdüsen-Funktionen der Website mobil zugänglich macht. Die öffentliche Homepage und ihre Marketing-Inhalte gehören nicht zur App. Die Düsen-Arena wird als eigener Bereich angeboten; ausgewählte Arena-Kennzahlen und persönliche Highlights können zusätzlich ins Dashboard integriert werden.

## Schritt 1: Funktionsumfang festlegen — abgeschlossen

Die Website wurde geprüft. Das Dashboard hat die Bereiche Aktivitäten, Physiologie, Trainingscoach, Trophäen und Benachrichtigungen. Angemeldete Mitglieder können außerdem andere Mitglieder und deren freigegebene Aktivitätsdetails ansehen. Die Arena umfasst Team-Kennzahlen, Monats-Challenge, Wochen-Champions, Bestenlisten, letzte Aktivitäten und Badges.

Für die mobile Umsetzung gilt daher folgender Umfang:

- **Anmeldung:** Strava OAuth; Anmeldung und Abmeldung in der App.
- **Dashboard:** persönliches Profil und Statistiken, Aktivitätenliste mit Details und vorhandenen Filtern, Physiologie, Trainingscoach, Trophäen/Wochenziel und Benachrichtigungen.
- **Mitglieder:** Mitgliederübersicht bzw. Auswahl und schreibgeschützte Profile/Aktivitäten anderer Mitglieder entsprechend den bestehenden Website-Berechtigungen.
- **Düsen-Arena:** Kennzahlen und Challenge, Champions, Bestenlisten mit Zeitraum-/Sportartauswahl, letzte Aktivitäten und Badges.
- **Dashboard-Integration der Arena:** kompakte Team-Kennzahlen und persönlicher Wochen-/Champion-Fortschritt; vollständige Arena bleibt separat erreichbar.
- **Nicht enthalten:** Homepage, öffentliche Marketingbereiche, Instagram-Feed und Website-Footer.

Dieser Umfang bildet die derzeitigen angemeldeten Dashboard- und Arena-Funktionen ab. Die App erhält eine mobile Navigation mit Dashboard und Arena als Hauptbereichen; weitere Dashboard-Funktionen liegen als Unterbereiche bzw. Tabs im Dashboard.

## Schritt 2: Expo-Grundgerüst und Repository-Struktur — abgeschlossen

- [x] Expo-App mit TypeScript unter `apps/mobile` anlegen; bestehende Next.js-App bleibt unter der Repository-Wurzel.
- [x] App-Manifeste, an SDK 57 ausgerichtete Abhängigkeiten und Startskripte für iOS und Android anlegen; Root-Kommandos `npm run mobile`, `npm run mobile:ios` und `npm run mobile:android` ergänzen.
- [x] Expo Router mit Dashboard-/Arena-Tabs, Login-Einstieg, Ladezustand und minimalem dunklem Basisdesign anlegen. Echte Sitzungswiederherstellung und Login-Aktion folgen in Schritt 3.
- [x] App-Scheme `dorfduesen` für den späteren OAuth-Rücksprung konfigurieren. Universal Links müssen später mit der echten Domain verknüpft werden.
- [x] Die relevanten installierten Next.js-Guides zu Projektstruktur, Route Handlers und Authentifizierung gelesen; in diesem Schritt waren keine Änderungen an Next.js-Routen erforderlich.
- [x] Expo-Abhängigkeiten installieren und `apps/mobile/package-lock.json` erzeugen.
- [ ] Start auf iOS-/Android-Simulator bzw. Gerät im Rahmen von Schritt 7 verifizieren.

Hinweis: Die Root-TypeScript-Konfiguration schließt `apps/mobile` aus, damit die beiden Projekte getrennt typisiert werden. Expo-Befehle und Voraussetzungen sind in `apps/mobile/README.md` dokumentiert. `npm install --prefix apps/mobile` meldete 21 Audit-Hinweise (3 moderat, 18 hoch); vor einem Update werden die betroffenen Pakete gezielt geprüft.

## Schritt 3: Native Strava-Anmeldung und App-Sitzung

- [x] Bestehenden serverseitigen Strava OAuth-Flow um einen mobilen Einstieg ergänzen; Web-Login bleibt cookie-basiert.
- [x] OAuth im Systembrowser ausführen. Der mobile Flow speichert gehashten `state` plus PKCE-Challenge serverseitig und prüft den `state` beim Callback.
- [x] Strava-Callback übergibt nur einen zwei Minuten gültigen, einmalig einlösbaren Code an `dorfduesen://auth/callback`; der Code ist an den PKCE-Verifier gebunden.
- [x] App tauscht den Code unter `/api/auth/mobile/exchange` gegen ein zufälliges Bearer-Token; nur dessen SHA-256-Hash wird gespeichert.
- [x] Mobile Sitzungen sind nach 30 Tagen ungültig und über `/api/auth/logout` widerrufbar. App-Sitzung und ausstehender PKCE-Verifier liegen in Expo SecureStore.
- [x] `getCurrentUser` akzeptiert mobile Bearer-Sitzungen und bestehende Web-Cookies; `/api/auth/me` dient zur Sitzungswiederherstellung.
- [x] Abbruch, ungültiger State/Code, abgelaufener Code und Logout werden behandelt.
- [x] Server-Callback `MOBILE_APP_REDIRECT_URI` und mobile `EXPO_PUBLIC_API_URL` dokumentiert.
- [x] Prisma-Schema und Migration für OAuth-State, Einmalcodes und widerrufbare Sitzungen angelegt.

**Umsetzungsstatus:** TypeScript-Prüfungen für Web und Mobile sind erfolgreich. Die Datenbankmigration wurde nicht auf eine Datenbank angewendet; OAuth-Ende-zu-Ende-Prüfung mit Strava und nativen Geräten ist für Schritt 7 vorgesehen. npm meldet weiterhin 21 Audit-Hinweise (3 moderat, 18 hoch); Pakete wurden nicht automatisch aktualisiert.

## Schritt 4: Mobile API-Verträge — umgesetzt

- [x] `GET /api/mobile/dashboard?page=1&sport=all|run|ride` liefert eine authentifizierte Dashboard-Übersicht mit Nutzer, paginierten Aktivitäten, Statistiken, den letzten fünf Physiologie-Messwerten, aktivem Trainingsplan, ungelesenen Benachrichtigungen und kompaktem Arena-/Wochenziel-Fortschritt.
- [x] `GET /api/mobile/arena?period=week|month|all&sport=all|run|ride` liefert Team-KPIs, Challenge, Wochen-Champions, Bestenliste, letzte Aktivitäten und Badge-Definitionen.
- [x] Beide neuen Endpunkte verlangen die bestehende Sitzung (mobil: `Authorization: Bearer …`), liefern bei fehlender Sitzung `401` und setzen `Cache-Control: private, no-store`.
- [x] Filterwerte sind begrenzt; ungültige Dashboard-Sportwerte fallen auf `all`, ungültige Arena-Filter auf `week`/`all` zurück. Aktivitäten nutzen dieselbe stabile Sortierung, korrigierte Distanzen und Pagination wie die Website. Datumswerte werden als ISO-8601-JSON-Strings serialisiert; Wochenlogik nutzt die bestehende Berlin-Zeitzonenlogik.
- [x] Bestehende nutzergebundene Aktions-/Detailrouten bleiben der gemeinsame Vertrag: `/api/strava/sync`, `/api/strava/activities/[stravaId]`, `/api/coach/metrics`, `/api/coach/profile`, `/api/coach/plan`, `/api/trophies`, `/api/arena/goals` sowie `/api/notifications` (inklusive PATCH zum Lesen markieren). Sie nutzen `getCurrentUser()` und akzeptieren damit auch mobile Bearer-Sitzungen.
- [x] Die mobile Arena-Route schützt auch ihre Bestenlisten-Daten hinter der Sitzung; die bestehende öffentliche Website-Route bleibt kompatibel.
- [x] Antworten der mobilen Übersichts-Endpunkte werden nicht zwischengespeichert; bestehende wiederverwendete Arena-Datenfunktionen behalten ihren Server-Cache.

**Umsetzungsstatus:** TypeScript-Prüfungen und API-Aufrufe gegen eine laufende Datenbank werden im Rahmen von Schritt 7 geprüft. Die Endpunkte verwenden vorhandene Datenfunktionen; es wurden keine Datenbankschemaänderungen vorgenommen.

## Schritt 5: Mobiles Dashboard — umgesetzt

- [x] Dashboard-Übersicht mit persönlichen Kennzahlen, Wochenziel und Arena-Kurzansicht gebaut.
- [x] Aktivitätenliste mit Lauf-/Radfiltern, Pagination, Aktivitätsdetails und Pull-to-refresh implementiert.
- [x] Physiologie mit Trainingszonen, VO₂max/VDOT, Messwerthistorie und Erfassung von Gewicht/Ruhepuls ergänzt.
- [x] Coach mit Trainingsprofil, editierbarer Verfügbarkeit/Terrain/Sonntagsrunde, Plananforderung und Anzeige der Trainingswochen/-einheiten ergänzt.
- [x] Trophäen, Wochenzielbearbeitung sowie Benachrichtigungen mit „als gelesen markieren“ angebunden.
- [x] Mitgliederauswahl und schreibgeschützte Profile/Aktivitäten eingebaut; private Physiologie-, Coach- und Benachrichtigungsbereiche bleiben auf das eigene Profil beschränkt.
- [x] API-Aufrufe nutzen die mobile Bearer-Sitzung aus SecureStore; mobile API-Erweiterung liefert nur die minimalen Mitgliederdaten für die Auswahl.

**Umsetzungsstatus:** TypeScript-Prüfungen für Web und Mobile sind erfolgreich. Prüfung auf iOS-/Android-Geräten und gegen echte API-/Datenbankdaten folgt in Schritt 7.

## Schritt 6: Mobile Düsen-Arena

- Arena als eigenen Navigationsbereich mit Team-Kennzahlen, Challenge und Wochen-Champions umsetzen.
- Bestenliste mit Zeitraum- und Sportartauswahl bauen.
- Letzte Aktivitäten und Badges für kleine Bildschirme gestalten.
- Links zwischen Arena-Mitgliedern und deren schreibgeschützten Dashboards abbilden.

## Schritt 7: Plattformprüfung und Release-Vorbereitung

- iOS und Android auf Anmeldung, App-Link-Rückkehr, Sitzungsspeicherung/-ablauf und Logout prüfen.
- Dashboard- und Arena-Daten mit der Website vergleichen; Berechtigungen und Fehler-/Offlinezustände prüfen.
- App-Konfiguration, Strava-Callback/Deep Links, Build-Konfiguration und notwendige Umgebungsvariablen dokumentieren.
- Erst nach erfolgreicher Prüfung Release-Builds bzw. Store-Einreichung vorbereiten.

## Arbeitsweise

Die Umsetzung erfolgt Schritt für Schritt. Nach jedem abgeschlossenen Schritt wird der Fortschritt in dieser Datei aktualisiert und kurz berichtet: was erledigt ist, was als Nächstes ansteht und ob der nächste Schritt begonnen werden soll.
