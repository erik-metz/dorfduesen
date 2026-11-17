import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support | Dorfdüsen',
  description: 'Hilfe und Kontakt für die Dorfdüsen-App.',
};

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8">
      <a href="/" className="text-sm font-semibold text-orange-400">← Dorfdüsen Nordheim</a>
      <h1 className="mt-7 text-3xl font-black tracking-tight text-white">Dorfdüsen Support</h1>
      <p className="mt-4 text-sm leading-7 text-zinc-300">Bei Fragen zur Anmeldung, zu Trainingsdaten oder zur Nutzung der App erreichst du Erik Metz per E-Mail.</p>
      <a className="mt-5 inline-flex rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-500" href="mailto:metzmade@pm.me">metzmade@pm.me</a>
      <h2 className="mt-9 text-lg font-bold text-white">Konto löschen</h2>
      <p className="mt-2 text-sm leading-7 text-zinc-300">Du kannst dein Dorfdüsen-Konto in der App im Dashboard über „Dorfdüsen-Konto löschen“ entfernen. Wenn du keinen Zugriff mehr auf die App hast, schreibe an die oben genannte Adresse. Weitere Informationen findest du in den <a className="text-orange-400 underline" href="/datenschutz">Datenschutzhinweisen</a>.</p>
      <footer className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-800 pt-5 text-xs text-zinc-500">
        <a className="underline" href="/impressum">Impressum</a>
        <a className="underline" href="/datenschutz">Datenschutz</a>
      </footer>
    </main>
  );
}
