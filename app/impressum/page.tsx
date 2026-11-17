import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum | Dorfdüsen',
  description: 'Anbieterkennzeichnung und Kontakt für Dorfdüsen.',
};

export default function ImpressumPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <a href="/" className="text-sm font-semibold text-orange-400">← Dorfdüsen Nordheim</a>
      <h1 className="mt-7 text-3xl font-black tracking-tight text-white">Impressum</h1>

      <section className="mt-6 space-y-3 text-sm leading-7 text-zinc-300">
        <h2 className="pt-5 text-lg font-bold text-white">Angaben gemäß § 5 DDG</h2>
        <p>Erik Metz<br />Schleegasse 7<br />68647 Biblis<br />Deutschland</p>

        <h2 className="pt-5 text-lg font-bold text-white">Kontakt</h2>
        <p>E-Mail: <a className="text-orange-400 underline" href="mailto:metzmade@pm.me">metzmade@pm.me</a></p>

      </section>

      <footer className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-800 pt-5 text-xs text-zinc-500">
        <a className="underline" href="/datenschutz">Datenschutz</a>
        <a className="underline" href="/support">Support</a>
      </footer>
    </main>
  );
}
