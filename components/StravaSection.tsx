import React from 'react';
import Image from 'next/image';
import { ExternalLink, Award, Users } from 'lucide-react';
import { ClubData } from '@/types/club';

interface StravaSectionProps {
  club: ClubData;
}

export function StravaSection({ club }: StravaSectionProps) {
  return (
    <section id="strava" className="py-20 md:py-28 bg-zinc-950/80 border-t border-zinc-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          {/* Strava Orange ambient blur */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#fc5200]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left side: Club info & description */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#fc5200] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#fc5200]/30">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.01 13.827h4.172" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    Offizieller Strava Club
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    {club.name}
                  </h3>
                </div>
              </div>

              <p className="text-base text-zinc-300 leading-relaxed max-w-2xl">
                Tracke deine Läufe, nimm an Club-Events teil und sieh, wer unter der Woche oder am Wochenende 
                in und um Nordheim und Biblis auf den Beinen ist. Wir feuern uns gegenseitig mit Kudos an!
              </p>

              {/* Members Facepile */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <Users className="w-4 h-4 text-orange-400" />
                  <span>Aktive Düsen im Club ({club.stats.stravaMembers} Mitglieder)</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3 overflow-hidden p-1">
                    {club.membersPreview.map((member, idx) => (
                      <div
                        key={idx}
                        className="relative w-11 h-11 rounded-full border-2 border-zinc-900 overflow-hidden shadow-md"
                        title={member.name}
                      >
                        <Image
                          src={member.avatar}
                          alt={member.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                    <div className="relative w-11 h-11 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-xs font-bold text-zinc-300">
                      +{club.stats.stravaMembers - club.membersPreview.length}
                    </div>
                  </div>

                  <span className="text-xs text-zinc-400 hidden sm:inline">
                    Komm dazu und werde Teil des Leaderboards!
                  </span>
                </div>
              </div>
            </div>

            {/* Right side: Direct Join CTA */}
            <div className="lg:col-span-4 flex flex-col items-stretch justify-center gap-4 bg-zinc-950/60 p-6 rounded-2xl border border-zinc-800/80">
              <div className="text-center space-y-1">
                <span className="text-xs uppercase font-extrabold text-zinc-400">Kostenlos & Direkt</span>
                <div className="text-xl font-bold text-white">Werde Mitglied auf Strava</div>
                <p className="text-xs text-zinc-400">
                  Egal welches Tempo oder welche Distanz – jeder Kilometer zählt.
                </p>
              </div>

              <a
                href={club.stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold bg-[#fc5200] hover:bg-[#e04800] text-white shadow-xl shadow-[#fc5200]/30 transition-all text-sm group"
              >
                <span>Club auf Strava beitreten</span>
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>

              <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400 pt-1">
                <Award className="w-3.5 h-3.5 text-orange-400" />
                <span>Wöchentliches Leaderboard & Club-Feed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
