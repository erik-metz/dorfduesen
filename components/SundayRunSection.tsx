import React from 'react';
import { Calendar, MapPin, Footprints, MessageCircle, CheckCircle, Zap } from 'lucide-react';
import { ClubData } from '@/types/club';

interface SundayRunProps {
  club: ClubData;
}

export function SundayRunSection({ club }: SundayRunProps) {
  const details = [
    {
      icon: Calendar,
      title: 'Wann?',
      value: 'Jeden Sonntag vormittags',
      sub: 'Regelmäßiger Treffpunkt – wetterfest & motiviert',
    },
    {
      icon: MapPin,
      title: 'Wo?',
      value: 'Nordheim (Gemeinde Biblis)',
      sub: 'Im wunderschönen Ried, flache Asphalt- & Feldwege',
    },
    {
      icon: Footprints,
      title: 'Distanz & Profil',
      value: 'ca. 5 Kilometer (flach)',
      sub: 'Anfängerfreundlich, mit Option auf Zusatzschleife',
    },
    {
      icon: Zap,
      title: 'Tempo & Pace',
      value: 'Kein Mindest-Pace',
      sub: 'Wir laufen zusammen – niemand wird zurückgelassen!',
    },
  ];

  return (
    <section id="sonntagsrunde" className="py-20 md:py-28 bg-zinc-950/70 border-y border-zinc-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Information */}
          <div className="lg:col-span-7 space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">
                Das wöchentliche Highlight
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
                Die Sonntagsrunde
              </h2>
              <p className="text-base sm:text-lg text-zinc-300 mt-4 leading-relaxed">
                {club.description}
              </p>
            </div>

            {/* Feature List Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {details.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-orange-600/10 text-orange-400">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        {item.title}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {item.value}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {item.sub}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Checklist */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ohne Vereinsmitgliedschaft & ohne Gebühren</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ideal für Einsteiger, Wiedereinsteiger und Hobbysportler</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zusatzrunden für ambitioniertere Läufer immer möglich</span>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-2">
              <a
                href={club.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30 transition-all text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Schreib uns kurz per DM auf Instagram
              </a>
            </div>
          </div>

          {/* Right Column: Visual Infobox / Step Guide */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>So bist du dabei</span>
              </h3>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-orange-600/20 border border-orange-500/40 text-orange-400 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Laufschuhe schnüren</h4>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                      Du brauchst kein Profi-Equipment. Bequeme Sportschuhe und gute Laune reichen völlig aus.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-orange-600/20 border border-orange-500/40 text-orange-400 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Kurz Hallo sagen</h4>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                      Meld dich kurz per Instagram DM (@dorfduesen) für den genauen Treffpunkt oder komm einfach dazu.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-orange-600/20 border border-orange-500/40 text-orange-400 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Mitdüsen & Spaß haben</h4>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                      5 km entspannt laufen, quatschen, die Ried-Landschaft genießen und sonntags voller Energie sein!
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
                <span className="text-xs text-zinc-400">
                  Fragen? Kein Problem – schreib uns einfach an!
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
