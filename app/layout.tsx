import { Suspense } from "react";
import { VisitSync } from "@/components/VisitSync";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dorfduesen.de"),
  title: "Dorfdüsen Nordheim | Runclub • Laufen. Rennrad. Eskalieren.",
  description:
    "Dorfdüsen Runclub Nordheim (Biblis) – Lauftruppe mit Spaß am Sport. Sonntagsrunde (5km flach, anfängerfreundlich, kein Mindest-Pace) & Rennrad-Ausfahrten. Zu langsam für Profis, zu schnell fürs Sofa!",
  keywords: [
    "Dorfdüsen",
    "Nordheim",
    "Biblis",
    "Lauftreff",
    "Runclub",
    "Laufen",
    "Rennrad",
    "Sonntagsrunde",
    "Strava",
    "Ried",
  ],
  authors: [{ name: "Dorfdüsen Nordheim" }],
  openGraph: {
    title: "Dorfdüsen Nordheim | Runclub",
    description:
      "Laufen. Rennrad. Eskalieren. Zu langsam für Profis, zu schnell fürs Sofa, genau richtig fürs Dorf. Komm sonntags mit!",
    url: "https://www.instagram.com/dorfduesen/",
    siteName: "Dorfdüsen Nordheim",
    images: [
      {
        url: "/images/strava/strava_cover.jpg",
        width: 1200,
        height: 630,
        alt: "Dorfdüsen Nordheim Runclub",
      },
    ],
    locale: "de_DE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <Suspense fallback={null}><VisitSync /></Suspense>
        {children}
      </body>
    </html>
  );
}
