import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  icons: {
    icon: "/images/instagram/profile_avatar.jpg",
    apple: "/images/instagram/profile_avatar.jpg",
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
        {children}
      </body>
    </html>
  );
}
