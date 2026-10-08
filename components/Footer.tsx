import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Flame, Heart } from 'lucide-react';
import { InstagramIcon } from '@/components/icons/BrandIcons';
import { ClubData } from '@/types/club';

interface FooterProps {
  club: ClubData;
}

export function Footer({ club }: FooterProps) {
  const currentYear = 2026;

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-zinc-800/80">
          {/* Brand info */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500">
                <Image
                  src={club.assets.instagramAvatar || club.assets.stravaAvatar}
                  alt={club.name}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-xl font-black text-white flex items-center gap-1.5">
                {club.name}
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              </span>
            </div>
            <p className="text-sm text-zinc-300 max-w-sm leading-relaxed">
              Die entspannte Lauftruppe aus Nordheim (Biblis). 
              Sonntagsrunde, Rennrad-Touren und gemeinsame Wettkämpfe mit jeder Menge Spaß am Sport.
            </p>
            <div className="text-xs font-semibold text-orange-400 tracking-wider uppercase">
              {club.tagline}
            </div>
          </div>

          {/* Quicklinks */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-sm font-bold uppercase text-white tracking-wider">
              Navigation
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#ueber-uns" className="hover:text-white transition-colors">
                  Über die Dorfdüsen
                </Link>
              </li>
              <li>
                <Link href="/#sonntagsrunde" className="hover:text-white transition-colors">
                  Die Sonntagsrunde (5km)
                </Link>
              </li>
              <li>
                <Link href="/arena" className="hover:text-orange-400 text-orange-400/90 font-bold transition-colors flex items-center gap-1">
                  <span>Düsen-Arena</span>
                  <span>🏆</span>
                </Link>
              </li>
              <li>
                <Link href="/#feed" className="hover:text-white transition-colors">
                  Feed & Galerie
                </Link>
              </li>
              <li>
                <Link href="/#strava" className="hover:text-white transition-colors">
                  Strava Club
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-white transition-colors">
                  Häufige Fragen
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Connect */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="text-sm font-bold uppercase text-white tracking-wider">
              Community & Social
            </h4>
            <p className="text-sm text-zinc-300">
              Folge uns auf Instagram für die neuesten Storys und Aktivitäten oder tritt unserem Strava-Club bei.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={club.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-orange-500 transition-colors"
              >
                <InstagramIcon className="w-5 h-5" />
              </a>
              <a
                href={club.stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Strava"
                className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-orange-500 hover:text-orange-400 hover:border-orange-500 transition-colors"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.01 13.827h4.172" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-4">
          <div className="flex items-center gap-1.5">
            <span>© {currentYear} Dorfdüsen Nordheim. Erstellt mit</span>
            <Heart className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            <span>für die Ried-Community.</span>
          </div>
          <div>
            <span>Biblis • Nordheim • Hessen</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
