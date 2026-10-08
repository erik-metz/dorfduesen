'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle, MessageSquare } from 'lucide-react';
import { ClubData } from '@/types/club';

interface FaqSectionProps {
  club: ClubData;
}

export function FaqSection({ club }: FaqSectionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Muss ich mich vorher offiziell anmelden oder Mitglied werden?',
      a: 'Nein! Wir sind kein bürokratischer Verein und verlangen keine Mitgliedsbeiträge. Schreib uns einfach kurz auf Instagram (@dorfduesen) eine Nachricht oder komm sonntags direkt dazu.',
    },
    {
      q: 'Was, wenn ich noch nie 5 km gelaufen bin oder sehr langsam laufe?',
      a: 'Genau dafür gibt es die Dorfdüsen! Unser Motto ist «Zu langsam für Profis, zu schnell fürs Sofa». Die Sonntagsrunde ist flach, anfängerfreundlich und es gibt keinen Mindest-Pace. Wir laufen als Gruppe los und niemand bleibt zurück.',
    },
    {
      q: 'Kostet das Mitmachen etwas?',
      a: 'Absolut gar nichts! Die Teilnahme an den Läufen und im Strava-Club ist 100% kostenlos. Es geht rein um Spaß am Sport und die Gemeinschaft.',
    },
    {
      q: 'Wann und wo startet die Sonntagsrunde genau?',
      a: 'Wir treffen uns sonntags vormittags in Nordheim (Gemeinde Biblis). Da sich die genaue Uhrzeit je nach Wetter und Jahreszeit leicht anpassen kann, schreib uns kurz per Instagram-DM oder check den Strava-Club für den aktuellen Treffpunkt.',
    },
    {
      q: 'Lauft ihr nur oder macht ihr auch andere Sportarten?',
      a: 'In unserer Bio steht nicht umsonst: «Laufen. Rennrad. Eskalieren.»! Neben dem Laufen finden regelmäßig gemeinsame Rennrad- und Gravelbike-Runden statt oder wir nehmen zusammen an Volks- und Stadtläufen in der Region teil.',
    },
    {
      q: 'Wie funktioniert der DorfDüsen Smart Coach und eure Trainingsphilosophie?',
      a: 'Unser Coach basiert auf fundierter Sportwissenschaft statt starrer Pauschalpläne: Wir nutzen das Jack Daniels VDOT-System, um deine individuellen Trainings-Paces (Easy, Threshold, Intervall) exakt anhand deiner echten Strava-Leistungen zu ermitteln. Nach dem 80/20-Prinzip (polarisiertes Training) absolvierst du rund 80 % deines Wochenumfangs im lockeren Grundlagenausdauer-Bereich (Zone 2) – das fördert die Mitochondriendichte und den Fettstoffwechsel, ohne das Nervensystem zu überlasten. Geplante Deload-Wochen und kontrollierte Steigerungen schützen vor Übertraining, während der Sonntagslauf als gemeinsamer Community-Longrun fest verankert ist.',
    },
  ];

  return (
    <section id="faq" className="py-20 md:py-28 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" /> Häufige Fragen
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
            Alles, was du wissen musst
          </h2>
          <p className="text-base sm:text-lg text-zinc-300">
            Noch unsicher, ob die Dorfdüsen das Richtige für dich sind? Hier findest du alle Antworten.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full text-left p-6 flex items-center justify-between gap-4 font-bold text-white hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <span className="text-base sm:text-lg">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-orange-500 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm sm:text-base text-zinc-300 leading-relaxed border-t border-zinc-800/60 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Direct contact prompt */}
        <div className="mt-12 text-center p-8 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col items-center gap-4">
          <MessageSquare className="w-8 h-8 text-orange-500" />
          <h3 className="text-xl font-bold text-white">Deine Frage war nicht dabei?</h3>
          <p className="text-sm text-zinc-300 max-w-md">
            Meld dich einfach unkompliziert per Instagram-Direktnachricht bei uns. Wir antworten so schnell wie möglich!
          </p>
          <a
            href={club.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30 transition-all text-sm"
          >
            Nachricht auf Instagram schreiben
          </a>
        </div>
      </div>
    </section>
  );
}
