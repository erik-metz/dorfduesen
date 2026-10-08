This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Server-Konfiguration

Kopiere `.env.example` nach `.env.local` und ersetze die Platzhalter. Zugangsdaten gehören nicht in Git.

- `DATABASE_URL`: PostgreSQL-Verbindung.
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`: OAuth-Anwendung; Callback `/api/auth/strava/callback`.
- `NEXT_PUBLIC_APP_URL`: öffentliche Basis-URL einschließlich Protokoll.
- `SESSION_SECRET`: eigener zufälliger Schlüssel mit mindestens 32 Zeichen. Ohne gültigen Schlüssel werden keine Sitzungen ausgestellt oder akzeptiert.
- `CRON_SECRET`: separater zufälliger Schlüssel mit mindestens 32 Zeichen. Der HTTP-Cron-Endpunkt ist sonst deaktiviert (503). Authentifizierung ausschließlich mit `Authorization: Bearer <CRON_SECRET>`; Query-Parameter werden nicht akzeptiert.
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`: in Produktion für Hintergrundjobs erforderlich.
- `XAI_API_KEY`: optional; ohne Schlüssel wird der algorithmische Coach verwendet.

Zufällige Schlüssel lassen sich lokal mit `openssl rand -hex 32` erzeugen. Die Werte nicht in Logs oder URLs schreiben. Ein Wechsel des Session-Schlüssels meldet bestehende Sitzungen ab.

Prüfungen: `npm run typecheck`, `npm run lint`, `npm test`. Tests verwenden isolierte Abhängigkeiten und greifen nicht auf Produktionsdienste zu.
