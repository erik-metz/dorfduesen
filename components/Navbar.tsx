'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Menu,
  X,
  Flame,
  Trophy,
  Calendar,
  Camera,
  HelpCircle,
  Info,
  ChevronRight,
  User as UserIcon,
  LayoutDashboard,
} from 'lucide-react';
import { ClubData } from '@/types/club';
import { StravaIcon, InstagramIcon } from '@/components/icons/BrandIcons';
import { isValidAvatarUrl } from '@/lib/utils/avatar';
import { NotificationBell } from '@/components/NotificationBell';

interface NavbarProps {
  club: ClubData;
  currentUser?: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    username: string | null;
    profile: string | null;
  } | null;
}

export function Navbar({ club, currentUser }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fetchedUser, setFetchedUser] = useState<typeof currentUser | null>(null);

  useEffect(() => {
    if (currentUser === undefined) {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.authenticated && data?.user) {
            setFetchedUser(data.user);
          }
        })
        .catch(() => {});
    }
  }, [currentUser]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const user = currentUser !== undefined ? currentUser : fetchedUser;

  const displayName = user
    ? [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username || 'Athlet'
    : null;

  const navItems = [
    {
      label: 'Sonntagsrunde',
      href: '/#sonntagsrunde',
      badge: '5 km',
      icon: Calendar,
      description: 'Jeden Sonntag 09:00 Uhr',
    },
    {
      label: 'Düsen-Arena',
      href: '/arena',
      badge: 'Neu',
      isSpecial: true,
      icon: Trophy,
      description: 'Leaderboard, Titel & Badges',
    },
    {
      label: 'Feed & Vibe',
      href: '/#feed',
      icon: Camera,
      description: 'Galerie & Community-Momente',
    },
    {
      label: 'Über uns',
      href: '/#ueber-uns',
      icon: Info,
      description: 'Die Story der Dorfdüsen',
    },
    {
      label: 'FAQ',
      href: '/#faq',
      icon: HelpCircle,
      description: 'Pace, Treffpunkt & Infos',
    },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/85 border-b border-zinc-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden ring-2 ring-orange-500/80 ring-offset-2 ring-offset-zinc-950 group-hover:scale-105 transition-all shadow-md shadow-orange-500/20">
              <Image
                src={club.assets.instagramAvatar || club.assets.stravaAvatar}
                alt={club.name}
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5 group-hover:text-orange-400 transition-colors">
                {club.name}
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500 inline-block animate-pulse" />
              </span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
                Runclub Nordheim
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links (Clean, Balanced Center) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3.5 py-2 rounded-full text-xs xl:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  item.isSpecial
                    ? 'text-orange-400 hover:text-white bg-orange-500/10 hover:bg-orange-600 border border-orange-500/30'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-900/80'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                      item.isSpecial
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Desktop Action Right (One Clear, Focused Element) */}
          <div className="hidden lg:flex items-center gap-3">
            {user && <NotificationBell />}
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-1.5 rounded-full text-xs font-bold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-white transition-all shadow-md group"
              >
                {isValidAvatarUrl(user.profile) ? (
                  <div className="relative w-6 h-6 rounded-full overflow-hidden ring-1 ring-orange-500">
                    <Image src={user.profile!} alt={displayName || ''} fill unoptimized className="object-cover" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-orange-600/20 text-orange-400 flex items-center justify-center">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
                <span className="truncate max-w-[130px]">{displayName}</span>
                <LayoutDashboard className="w-3.5 h-3.5 text-zinc-400 group-hover:text-orange-400 transition-colors" />
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#fc5200] hover:bg-[#e04800] text-white shadow-lg shadow-[#fc5200]/25 hover:shadow-[#fc5200]/40 transition-all active:scale-95"
              >
                <StravaIcon className="w-4 h-4 text-white" />
                <span>Mit Strava verbinden</span>
              </Link>
            )}
          </div>

          {/* Mobile Right Bar: Fast Action + Hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            {user && <NotificationBell />}
            {/* Quick Profile/Login Button on Mobile */}
            {user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-bold text-white"
                aria-label="Dashboard"
              >
                {isValidAvatarUrl(user.profile) ? (
                  <div className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-orange-500">
                    <Image src={user.profile!} alt={displayName || ''} fill unoptimized className="object-cover" />
                  </div>
                ) : (
                  <UserIcon className="w-4 h-4 text-orange-400" />
                )}
                <span className="hidden sm:inline text-xs truncate max-w-[90px]">{displayName}</span>
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#fc5200] text-white shadow-sm"
              >
                <StravaIcon className="w-3.5 h-3.5 text-white" />
                <span className="text-[11px] sm:text-xs">Login</span>
              </Link>
            )}

            {/* Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 sm:p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 focus:outline-none transition-colors"
              aria-label={mobileMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-zinc-200" />
              ) : (
                <Menu className="w-5 h-5 text-orange-500" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modern Mobile Slide-Down / Full-Screen Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-18 sm:top-20 bottom-0 z-40 bg-zinc-950/98 backdrop-blur-2xl border-t border-zinc-800/80 overflow-y-auto px-4 py-6 flex flex-col justify-between">
          <div className="space-y-4 max-w-md mx-auto w-full">
            {/* Athlete Status Card in Drawer */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl">
              {user ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isValidAvatarUrl(user.profile) ? (
                      <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-orange-500">
                        <Image src={user.profile!} alt={displayName || ''} fill unoptimized className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-orange-600/20 text-orange-400 flex items-center justify-center font-black">
                        {displayName?.charAt(0) || 'A'}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold text-zinc-400">Eingeloggt als</div>
                      <div className="text-sm font-black text-white">{displayName}</div>
                    </div>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md transition-all flex items-center gap-1.5"
                  >
                    <span>Dashboard</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-600/20 text-orange-500 flex items-center justify-center shrink-0">
                      <Flame className="w-5 h-5 fill-orange-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Dorfdüsen Club Sync</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Verbinde Strava, um deine Läufe für die Arena und Ranglisten zu synchronisieren.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#fc5200] text-white shadow-lg shadow-[#fc5200]/30 transition-all"
                  >
                    <StravaIcon className="w-4 h-4 text-white" />
                    <span>Mit Strava verbinden</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Navigation Cards */}
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-2">
                Menü
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      item.isSpecial
                        ? 'bg-gradient-to-r from-orange-950/40 to-zinc-900 border-orange-500/30 text-white'
                        : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/80 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          item.isSpecial
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-2">
                          <span>{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                item.isSpecial
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400">{item.description}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Social Footer in Drawer */}
          <div className="pt-6 pb-2 max-w-md mx-auto w-full border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-center gap-3">
              <a
                href={club.stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
              >
                <StravaIcon className="w-4 h-4 text-orange-500" />
                <span>Strava Club</span>
              </a>
              <a
                href={club.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
              >
                <InstagramIcon className="w-4 h-4 text-pink-500" />
                <span>Instagram</span>
              </a>
            </div>
            <div className="text-center text-[11px] text-zinc-500">
              Dorfdüsen Nordheim © 2026 • Run together, fly together
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
