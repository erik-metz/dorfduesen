import React from 'react';
import Image from 'next/image';
import { ArrowRight, Flame, MapPin } from 'lucide-react';
import { ClubData } from '@/types/club';

interface HeroProps {
  club: ClubData;
}

export function Hero({ club }: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
      {/* Background with Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-orange-600/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Typography & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Location & Tag Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-700/80 text-zinc-300 text-xs font-semibold tracking-wide shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-orange-400 font-bold uppercase">Offizieller Runclub</span>
              <span className="text-zinc-600">•</span>
              <span className="flex items-center gap-1 text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" /> Nordheim (Biblis)
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl xl:text-7xl font-black tracking-tighter text-white uppercase leading-[1.05]">
              Laufen. <br />
              <span className="text-zinc-400">Rennrad.</span> <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600">
                Eskalieren.
              </span>
            </h1>

            {/* Subline */}
            <p className="text-lg sm:text-xl text-zinc-300 max-w-2xl font-normal leading-relaxed mx-auto lg:mx-0">
              Lauftruppe aus Nordheim mit maximalem Spaß am Sport. 
              Kein Mindest-Pace, keine Ausreden, dafür umso mehr Teamgeist 
              und die legendäre wöchentliche Sonntagsrunde!
            </p>

            {/* Quote / Punchlines Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-left max-w-xl shadow-xl shadow-black/40">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" /> Dorfdüsen Kodex
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm font-semibold text-zinc-200">
                <div className="flex items-center gap-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                  <span className="text-lg">😴</span>
                  <span>Zu langsam für Profis</span>
                </div>
                <div className="flex items-center gap-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                  <span className="text-lg">🔥</span>
                  <span>Zu schnell fürs Sofa</span>
                </div>
                <div className="flex items-center gap-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                  <span className="text-lg">🍺</span>
                  <span>Genau richtig fürs Dorf</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#sonntagsrunde"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-base font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-xl shadow-orange-600/30 hover:shadow-orange-600/50 transition-all group"
              >
                Sonntagsrunde entdecken
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href={club.stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-base font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 transition-all"
              >
                Auf Strava mitdüsen
              </a>
            </div>
          </div>

          {/* Right Column: Dynamic Visual Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Border glow frame */}
              <div className="relative rounded-3xl overflow-hidden border-2 border-zinc-800 shadow-2xl bg-zinc-900 group">
                <div className="relative h-96 sm:h-[480px] w-full">
                  <Image
                    src={club.assets.stravaCover || '/images/strava/strava_cover.jpg'}
                    alt="Dorfdüsen Action"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    priority
                  />
                  {/* Gradient bottom overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-0 inset-x-0 p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full bg-orange-600 text-white">
                      Community First
                    </span>
                    <span className="text-xs font-semibold text-zinc-300">
                      Sonntagsrunde • 5 km
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    «ZÜNDEN. RENNEN. DURCHDREHEN.»
                  </h3>
                  <p className="text-xs text-zinc-300 line-clamp-2">
                    Egal ob gemütlicher Dauerlauf oder Wettkampf-Eskalation – bei den Dorfdüsen zählt der Zusammenhalt.
                  </p>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-6 -left-6 sm:-bottom-8 sm:-left-8 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 shadow-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-500 font-black text-xl">
                  🚀
                </div>
                <div>
                  <div className="text-sm font-bold text-white">100% Einsteigerfreundlich</div>
                  <div className="text-xs text-zinc-400">Kein Mindest-Pace nötig!</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
