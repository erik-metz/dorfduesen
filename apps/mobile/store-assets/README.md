# Store-Vorbereitung – Dorfdüsen

Status: **Arbeitsentwurf, noch nicht einreichungsfertig**. Dieses Paket sammelt Store-Texte, Grafikdateien und offene Freigabepunkte für iOS und Android.

## Dateien

- `icons/`: App-Icon für iOS, Android Adaptive Icon Vordergrund/Hintergrund und monochromes Symbol.
- `google-play-feature-graphic-1024x500.png`: Entwurf des Google-Play-Feature-Bildes.
- `screenshots/ios-6.7/`: fünf Entwurfsbilder im Format 1290 × 2796.
- `screenshots/google-play/`: dieselben fünf Motive im Format 1080 × 1920.
- `store-listing-de.md`: Texte für die deutsche Store-Seite.
- `privacy-policy-draft-de.md`: Datenschutztext als auszufüllender Entwurf.
- `reviewer-notes-de.md`: Hinweise und Zugangsdaten, die für die Store-Prüfung vorzubereiten sind.
- `release-checklist.md`: vor Einreichung zu erledigende Punkte.
- `generate-assets.mjs`: Skript zur erneuten Erzeugung der PNG-Dateien.

## Grafiken und Screenshots

Die Icons und das Feature-Bild sind eigens für Dorfdüsen gestaltet. Die Screenshots sind **Layout-Mockups** und enthalten ausschließlich erfundene Beispieldaten und Namen. Sie zeigen nicht die App im tatsächlichen Laufzustand. Vor Einreichung müssen sie durch unveränderte Aufnahmen der freizugebenden App-Version ersetzt werden. Insbesondere muss die Arena-Darstellung samt Clubdaten und Rangliste vor Nutzung in öffentlichen Store-Grafiken anhand der aktuellen Strava API-Vereinbarung und der für das Projekt geltenden Freigabe geprüft werden. Bis dahin Arena-Motiv nicht veröffentlichen.

Die generierten Trophäen-Emojis und die simplifizierten Mockup-Karten sind Teil des Entwurfs. Für finale Screenshots bitte die echte App mit genehmigten, anonymisierten/Testdaten verwenden; keine privaten Strava-Daten anderer Personen in Store-Material übernehmen.

## Erneut generieren

Vom Repository-Root aus:

```sh
node apps/mobile/store-assets/generate-assets.mjs
```

Das Skript verwendet das bereits im Repository installierte `sharp`-Paket. Die Bilddateien können neu erzeugt werden, ohne manuelle Bearbeitung.

## Branding

Die Entwürfe nutzen Dorfdüsen-Farben und ein eigenes Pfeilzeichen. Es werden keine Strava-Markenlogos oder Strava-App-Screens als eigene Markenbestandteile verwendet. Eine Strava-Integration ist im Text sachlich zu benennen und darf nicht den Eindruck einer offiziellen Strava-App oder Empfehlung erwecken.
