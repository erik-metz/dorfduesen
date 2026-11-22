# Datenschutzhinweise – Release-Entwurf

Die öffentliche Seitenquelle liegt in [`app/datenschutz/page.tsx`](../../../app/datenschutz/page.tsx); vorgesehen ist `https://dorfduesen.de/datenschutz`. Sie enthält inzwischen die vom Anbieter bestätigten Kontaktdaten, die im Repository nachvollziehbaren Datenflüsse und die allgemeinen, öffentlich dokumentierten Verarbeitungsregionen und Aufbewahrungsregeln der Dienste.

Tarifabhängige und projektbezogene Anbieterwerte sind als solche beschrieben und nicht als konkrete Accountwerte behauptet. Die Statusnotiz in `ios-release-status.md` führt die noch offenen rechtlichen und Store-Review-Fragen auf.

## App-Updates

Die Dorfdüsen-App prüft beim Start, ob ein App-Update vorliegt, und lädt es gegebenenfalls über den Dienst EAS Update von Expo (650 Industries, Inc., USA). Dabei werden technische Daten übertragen, insbesondere IP-Adresse, Betriebssystem, App- und Laufzeitversion sowie die Kennung des installierten Updates; Konto-, Trainings- oder Gesundheitsdaten werden dabei nicht übermittelt. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und aktuellen App (Art. 6 Abs. 1 lit. f DSGVO). Weitere Informationen: [Expo-Datenschutzerklärung](https://expo.dev/privacy).
