'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X, Flame } from 'lucide-react';
import { ClubData } from '@/types/club';

interface NavbarProps {
  club: ClubData;
}

export function Navbar({ club }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Über uns', href: '#ueber-uns' },
    { label: 'Sonntagsrunde', href: '#sonntagsrunde' },
    { label: 'Feed & Galerie', href: '#feed' },
    { label: 'Strava Club', href: '#strava' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-orange-500 shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Image
                src={club.assets.instagramAvatar || club.assets.stravaAvatar}
                alt={club.name}
                fill
                className="object-cover"
                priority
              />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                {club.name}
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500 inline-block animate-pulse" />
              </span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-orange-400">
                Runclub Nordheim
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={club.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-100 transition-all border border-zinc-700"
            >
              Instagram
            </a>
            <a
              href={club.stravaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30 transition-all"
            >
              Strava Club
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 focus:outline-none"
              aria-label="Menü öffnen"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-orange-500" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950 px-4 pt-2 pb-6 space-y-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
            <a
              href={club.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center py-2.5 rounded-lg text-sm font-bold bg-zinc-800 text-zinc-100"
            >
              Instagram (@dorfduesen)
            </a>
            <a
              href={club.stravaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center py-2.5 rounded-lg text-sm font-bold bg-orange-600 text-white"
            >
              Strava Club beitreten
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
