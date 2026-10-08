import React from 'react';
import { Sparkles, HeartHandshake, ShieldCheck } from 'lucide-react';
import { ClubData } from '@/types/club';

interface SpiritProps {
  club: ClubData;
}

export function SpiritSection({ club }: SpiritProps) {
  const cards = [
    {
      emoji: '😴',
      title: 'Zu langsam für Profis',
      desc: 'Kein elitäres Vereinsgehabe, keine Bestzeiten-Tabellen, kein Druck. Wer mitlaufen will, läuft mit – ganz ohne Leistungsdruck.',
      icon: HeartHandshake,
      badge: 'Jeder ist willkommen',
    },
    {
      emoji: '🔥',
      title: 'Zu schnell fürs Sofa',
      desc: 'Gemeinsam siegt man gegen den inneren Schweinehund. Raus an die frische Ried-Luft, den Kreislauf ankurbeln und Gas geben.',
      icon: Sparkles,
      badge: 'Pure Motivation',
    },
    {
      emoji: '🍺',
      title: 'Genau richtig fürs Dorf',
      desc: 'Sport, Gemeinschaft und eine gesunde Portion Selbstironie. Hier zählt das Miteinander im Dorf mehr als jede GPS-Uhr.',
      icon: ShieldCheck,
      badge: 'Teamgeist Nordheim',
    },
  ];

  return (
    <section id="ueber-uns" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
            Unsere Philosophie
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
            Der {club.name} Kodex
          </h2>
          <p className="text-base sm:text-lg text-zinc-300">
            Wir sind kein klassischer Leichtathletik-Verein, sondern eine motivierte 
            Truppe aus Nordheim und Umgebung, die Spaß an Sport und Bewegung feiert.
          </p>
        </div>

        {/* 3 Main Philosophy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((card, idx) => {
            return (
              <div
                key={idx}
                className="relative rounded-3xl bg-zinc-900/60 border border-zinc-800 p-8 flex flex-col justify-between hover:border-orange-500/50 transition-all hover:-translate-y-1 group shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-4xl p-3 bg-zinc-950 rounded-2xl border border-zinc-800 inline-block shadow-inner">
                      {card.emoji}
                    </span>
                    <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-white mb-3 tracking-tight">
                    {card.title}
                  </h3>

                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-zinc-800/80 flex items-center gap-2 text-xs font-bold text-orange-400">
                  <span>Dorfdüsen Prinzip #{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Big Quote / Statement Box */}
        <div className="mt-16 rounded-3xl bg-gradient-to-r from-orange-950/40 via-zinc-900/90 to-zinc-900/40 border border-orange-500/30 p-8 sm:p-12 relative overflow-hidden">
          <div className="max-w-3xl space-y-4 relative z-10">
            <span className="text-xs font-black uppercase tracking-widest text-orange-400">
              Original Dorfdüsen Mindset
            </span>
            <blockquote className="text-xl sm:text-2xl font-bold text-white italic leading-snug">
              «Kilometer? Egal. Beine? Irgendwann auch egal. Puls? Hat sich selbstständig gemacht. 
              Vernunft? War gar nicht erst am Start. ZÜNDEN. RENNEN. DURCHDREHEN.»
            </blockquote>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-8 h-0.5 bg-orange-500" />
              <p className="text-sm font-semibold text-zinc-400">
                Aus dem Dorfdüsen Wettkampf-Tagebuch (EWR Stadtlauf Bürstadt)
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
