export interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: 'DISTANCE' | 'STREAK' | 'SPECIAL' | 'SPEED' | 'WEEKLY' | 'MONTHLY' | 'COMMUNITY';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  hint?: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // --- DISTANCE & MEILENSTEINE ---
  {
    code: 'FIRST_DUESTE',
    name: 'Startschuss',
    description: 'Erste Aktivität erfolgreich mit den Dorfdüsen synchronisiert.',
    icon: '🚀',
    category: 'SPECIAL',
    rarity: 'COMMON',
    hint: 'Verbinde Strava und lade deine erste Aktivität hoch.',
  },
  {
    code: 'FIVE_K_BLAST',
    name: 'Fünfer-Rakete',
    description: 'Einen Einzellauf von mindestens 5,0 km absolviert.',
    icon: '⚡',
    category: 'DISTANCE',
    rarity: 'COMMON',
    hint: 'Absolviere einen Lauf von mindestens 5 km.',
  },
  {
    code: 'TEN_K_CLUB',
    name: 'Zehner-Kante',
    description: 'Einen Einzellauf von mindestens 10,0 km gemeistert.',
    icon: '🎯',
    category: 'DISTANCE',
    rarity: 'RARE',
    hint: 'Laufe zweistellig: mindestens 10 km am Stück.',
  },
  {
    code: 'HALF_MARATHON',
    name: 'Eskalations-Modus',
    description: 'Einen Einzellauf von mindestens 21,1 km (Halbmarathon) absolviert.',
    icon: '🏅',
    category: 'DISTANCE',
    rarity: 'EPIC',
    hint: 'Knacke die Halbmarathon-Distanz von 21,1 km.',
  },
  {
    code: 'MARATHON_HERO',
    name: 'Die Königsdisziplin',
    description: 'Die magische Marathondistanz von 42,195 km im Einzellauf gefinisht!',
    icon: '👑',
    category: 'DISTANCE',
    rarity: 'LEGENDARY',
    hint: 'Absolviere einen Marathon von mindestens 42,195 km.',
  },
  {
    code: 'MOUNTAIN_GOAT',
    name: 'Bergfex im Ried',
    description: 'Über 300 Höhenmeter in einer einzigen Aktivität gemeistert.',
    icon: '⛰️',
    category: 'SPECIAL',
    rarity: 'RARE',
    hint: 'Sammle mindestens 300 Höhenmeter in einem Lauf.',
  },
  {
    code: 'LIFETIME_100K',
    name: '100 Club-Kilometer',
    description: 'Über 100 Gesamtkilometer für die Dorfdüsen auf den Asphalt gebracht.',
    icon: '🥉',
    category: 'DISTANCE',
    rarity: 'COMMON',
    hint: 'Sammle 100 km über alle Aktivitäten hinweg.',
  },
  {
    code: 'LIFETIME_500K',
    name: '500 Club-Kilometer',
    description: 'Stolze 500 Gesamtkilometer im Dorfdüsen-Trikot gesammelt.',
    icon: '🥈',
    category: 'DISTANCE',
    rarity: 'RARE',
    hint: 'Erreiche 500 Gesamtkilometer.',
  },
  {
    code: 'LIFETIME_1000K',
    name: '1.000er Legende',
    description: 'Über 1.000 Kilometer für die Dorfdüsen – du bist eine lebende Club-Legende!',
    icon: '🥇',
    category: 'DISTANCE',
    rarity: 'LEGENDARY',
    hint: 'Knacke 1.000 Gesamtkilometer im Club.',
  },

  // --- MONATLICHE AUSZEICHNUNGEN ---
  {
    code: 'MONTH_KING',
    name: 'Monats-König',
    description: 'Monatssieger mit den meisten Gesamtkilometern im gesamten Club.',
    icon: '🏆',
    category: 'MONTHLY',
    rarity: 'LEGENDARY',
    hint: 'Sammle am Monatsende die meisten Kilometer im Club.',
  },
  {
    code: 'CENTURY_CLUB',
    name: 'Century Club (100k/M)',
    description: 'Über 100 Kilometer in einem einzigen Kalendermonat gesammelt.',
    icon: '💯',
    category: 'MONTHLY',
    rarity: 'RARE',
    hint: 'Erreiche 100 km innerhalb eines Kalendermonats.',
  },
  {
    code: 'DOUBLE_CENTURY',
    name: 'Double Century (200k/M)',
    description: 'Über 200 Kilometer in einem Kalendermonat gesammelt. Reine Hingabe!',
    icon: '🚀',
    category: 'MONTHLY',
    rarity: 'EPIC',
    hint: 'Erreiche 200 km innerhalb eines Kalendermonats.',
  },
  {
    code: 'MONTH_STREAKER',
    name: 'Monats-Streaker',
    description: 'In jeder einzelnen Woche des Monats mindestens 2 Aktivitäten abgeliefert.',
    icon: '🔥',
    category: 'MONTHLY',
    rarity: 'RARE',
    hint: 'Mindestens 2 Läufe/Fahrten pro Woche über einen ganzen Monat.',
  },

  { code: 'WEEKLY_RUN_DISTANCE', name: 'Laufleistung der Woche', description: 'Die meisten Laufkilometer der Woche.', icon: '🏃', category: 'WEEKLY', rarity: 'RARE', hint: 'Sammle Laufkilometer. Bei Gleichstand teilen sich alle den Sieg.' },
  { code: 'WEEKLY_RIDE_DISTANCE', name: 'Radleistung der Woche', description: 'Die meisten Radkilometer der Woche, ohne E-Bike.', icon: '🚲', category: 'WEEKLY', rarity: 'RARE', hint: 'Sammle Radkilometer. Bei Gleichstand teilen sich alle den Sieg.' },
  { code: 'WEEKLY_STAYED_ACTIVE', name: 'Drangeblieben', description: 'An mindestens zwei verschiedenen Tagen der Woche aktiv.', icon: '🌱', category: 'WEEKLY', rarity: 'RARE', hint: 'Jeder aktive Kalendertag zählt einmal, unabhängig von Distanz und Tempo.' },
  { code: 'WEEKLY_ROUTINE', name: 'Gute Routine', description: 'Drei Wochen in Folge jeweils mindestens zwei aktive Tage.', icon: '📅', category: 'WEEKLY', rarity: 'RARE', hint: 'Bleibe drei Wochen regelmäßig dabei.' },
  { code: 'WEEKLY_GOAL', name: 'Wochenziel geschafft', description: 'Das vor Wochenbeginn selbst gewählte Ziel erreicht.', icon: '🎯', category: 'WEEKLY', rarity: 'RARE', hint: 'Lege in der Arena dein Tagesziel für nächste Woche fest.' },
  { code: 'WEEKLY_PROGRESS', name: 'Persönlicher Fortschritt', description: 'Mehr aktive Tage als im Durchschnitt der vier Vorwochen.', icon: '✨', category: 'WEEKLY', rarity: 'RARE', hint: 'Nach vier vollständigen Wochen zählt dein eigener Vergleich, auch Wochen ohne Training.' },

  // --- WÖCHENTLICHE KRONEN (LEVELBAR DURCH SIEGE) ---
  {
    code: 'WEEKLY_ELEVATION',
    name: 'Wochensieg: Die Bergziege',
    description: 'Als Champion der Woche die meisten Höhenmeter im Ried erklommen.',
    icon: '⛰️',
    category: 'WEEKLY',
    rarity: 'EPIC',
    hint: 'Gewinne eine Kalenderwoche bei den Höhenmetern.',
  },
  {
    code: 'WEEKLY_DISTANCE',
    name: 'Wochensieg: Kilometer-Krone',
    description: 'Als Wochenbester die meisten Laufkilometer im Club abgerissen.',
    icon: '👑',
    category: 'WEEKLY',
    rarity: 'EPIC',
    hint: 'Gewinne eine Kalenderwoche bei den Laufkilometern.',
  },
  {
    code: 'WEEKLY_TIME',
    name: 'Wochensieg: Ausdauer-Büffel',
    description: 'Als Champion der Woche die meiste Zeit in Laufschuhen verbracht.',
    icon: '⏱️',
    category: 'WEEKLY',
    rarity: 'EPIC',
    hint: 'Gewinne eine Kalenderwoche bei der Bewegungszeit.',
  },
  {
    code: 'WEEKLY_HEARTRATE',
    name: 'Wochensieg: Eisenlunge',
    description: 'Als Puls-Champion den höchsten Herzfrequenz-Peak der Woche hingelegt.',
    icon: '💓',
    category: 'WEEKLY',
    rarity: 'EPIC',
    hint: 'Historische Trophäe – wird ab der Woche vom 05.10.2026 nicht mehr vergeben.',
  },
  {
    code: 'WEEKLY_EARLYBIRD',
    name: 'Wochensieg: Frühaufsteher',
    description: 'Als Frühaufsteher-Champion die früheste Einheit vor 08:00 Uhr geloggt.',
    icon: '🌅',
    category: 'WEEKLY',
    rarity: 'EPIC',
    hint: 'Gewinne eine Woche mit dem frühesten Frühstart.',
  },
  {
    code: 'WEEKLY_CONSISTENCY',
    name: 'Wochensieg: Dauer-Düser',
    description: 'Als Trainingsfleißigster die meisten Einheiten in der Woche abgeliefert.',
    icon: '📅',
    category: 'WEEKLY',
    rarity: 'EPIC',
    hint: 'Gewinne eine Woche mit den meisten Trainingstagen.',
  },

  // --- DORFDÜSEN-KULT & COMMUNITY ---
  {
    code: 'SUNDAY_WARRIOR',
    name: 'Sonntags-Treue',
    description: 'An mindestens 3 Sonntagen aktiv bei der Sonntagsrunde mitgedüst.',
    icon: '🏃‍♂️',
    category: 'COMMUNITY',
    rarity: 'RARE',
    hint: 'Laufe an mindestens 3 Sonntagen.',
  },
  {
    code: 'SOFA_SURVIVOR',
    name: 'Zu schnell fürs Sofa',
    description: 'An 3 aufeinanderfolgenden Tagen aktiv gewesen. Das Sofa hatte keine Chance!',
    icon: '🛋️',
    category: 'STREAK',
    rarity: 'RARE',
    hint: 'Logge Aktivitäten an 3 aufeinanderfolgenden Kalendertagen.',
  },
  {
    code: 'DAWN_PATROL',
    name: 'Morgen-Patrouille',
    description: 'Aktivität vor 07:00 Uhr morgens gestartet. Der frühe Düser fängt den Wind!',
    icon: '🌄',
    category: 'SPECIAL',
    rarity: 'RARE',
    hint: 'Starte einen Lauf oder eine Fahrt vor 07:00 Uhr Ortszeit.',
  },
  {
    code: 'NIGHT_OWL',
    name: 'Nachteule',
    description: 'Aktivität nach 21:00 Uhr gestartet. Die Straßen von Nordheim gehören dir!',
    icon: '🦉',
    category: 'SPECIAL',
    rarity: 'RARE',
    hint: 'Starte eine Aktivität nach 21:00 Uhr.',
  },
  {
    code: 'CHAIN_RIGHT',
    name: 'Kette rechts',
    description: 'Eine Rennrad- oder Radausfahrt von mindestens 50,0 km absolviert.',
    icon: '🚲',
    category: 'SPECIAL',
    rarity: 'RARE',
    hint: 'Fahre mindestens 50 km mit dem Rad.',
  },
];

import type { PrismaClient } from '@prisma/client';

let seeded = false;

/**
 * Ensures all defined badges exist in the Prisma database.
 * Cached in-process so it runs once per application lifecycle.
 */
export async function ensureBadgesSeeded(db: PrismaClient) {
  if (seeded) return;
  for (const b of BADGE_DEFINITIONS) {
    await db.badge.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        description: b.description,
        icon: b.icon,
        category: b.category,
        rarity: b.rarity,
      },
      create: {
        code: b.code,
        name: b.name,
        description: b.description,
        icon: b.icon,
        category: b.category,
        rarity: b.rarity,
      },
    });
  }
  seeded = true;
}
