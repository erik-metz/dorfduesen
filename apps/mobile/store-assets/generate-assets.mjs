import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(new URL(import.meta.url).pathname);
const iconDir = path.join(root, 'icons');
const draftIosDir = path.join(root, 'screenshots', 'drafts', 'ios');
const draftPlayDir = path.join(root, 'screenshots', 'drafts', 'google-play');
await fs.mkdir(iconDir, { recursive: true });

const orange = '#fc5200';
const bg = '#09090b';
const panel = '#18181b';
const line = '#303038';
const white = '#fafafa';
const muted = '#a1a1aa';

function logoSvg(size, color = orange) {
  const width = size * 0.46;
  const start = size * 0.31;
  const end = size * 0.70;
  const inset = size * 0.18;
  const stroke = size * 0.075;
  return `<path d="M ${start} ${end} L ${end} ${start} M ${size * 0.43} ${start} H ${end} V ${size * 0.57}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="square" stroke-linejoin="miter"/>`;
}

function appIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><radialGradient id="glow"><stop stop-color="#32180f"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#glow)"/>
    <rect x="205" y="205" width="614" height="614" rx="174" fill="#1b100c" stroke="#85360f" stroke-width="12"/>
    <g transform="translate(145 145) scale(0.72)">${logoSvg(1024, orange)}</g>
  </svg>`;
}

function adaptiveIcon(monochrome = false) {
  const color = monochrome ? '#ffffff' : orange;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432">
    <g transform="scale(0.42)">${logoSvg(1024, color)}</g>
  </svg>`;
}

async function png(svg, filepath, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(filepath);
}

await png(appIcon(), path.join(iconDir, 'app-icon-1024.png'), 1024, 1024);
await png(adaptiveIcon(), path.join(iconDir, 'android-adaptive-foreground-432.png'), 432, 432);
await png(adaptiveIcon(true), path.join(iconDir, 'android-adaptive-monochrome-432.png'), 432, 432);
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432"><rect width="432" height="432" fill="${bg}"/></svg>`, path.join(iconDir, 'android-adaptive-background-432.png'), 432, 432);

const logoSmall = (x, y, size = 54) => `<g transform="translate(${x} ${y}) scale(${size / 1024})">${logoSvg(1024, orange)}</g>`;

const screens = [
  {
    slug: '01-dashboard',
    headline: 'Dein Training.\nAuf einen Blick.',
    subhead: 'Aktivitäten, Fortschritt und Laufjahr kompakt im Dashboard.',
    body: `<text x="86" y="0" class="eyebrow">DEIN DASHBOARD</text>
      <text x="86" y="88" class="h2">Guten Lauf, Mara</text>
      <text x="86" y="140" class="small">RUNCLUB NORDHEIM · STRAVA VERBUNDEN</text>
      <g transform="translate(62 190)"><rect width="966" height="235" rx="28" class="card"/><text x="32" y="58" class="label">DEIN LAUFJAHR</text><text x="32" y="150" class="big">286,4 km</text><text x="32" y="198" class="small">38 Aktivitäten · 29 Std. · 1.640 hm</text></g>
      <text x="86" y="506" class="h3">Aktivitäten</text>
      ${activityCard(62, 548, 'Abendrunde am Fluss', 'Laufen · Heute, 18:42', '8,42 km', '46:15', '5:29 /km')}
      ${activityCard(62, 772, 'Locker durch Nordheim', 'Laufen · Dienstag', '6,10 km', '35:20', '5:47 /km')}
      <g transform="translate(62 1010)"><rect width="966" height="118" rx="24" class="cardAlt"/><text x="34" y="50" class="label">WOCHENZIEL</text><text x="34" y="91" class="body">3 von 4 aktiven Tagen</text><rect x="645" y="51" width="270" height="16" rx="8" fill="#38383f"/><rect x="645" y="51" width="202" height="16" rx="8" fill="${orange}"/></g>`
  },
  {
    slug: '02-aktivitaeten',
    headline: 'Jede Einheit.\nIm Detail.',
    subhead: 'Distanz, Tempo, Höhenmeter und Splits direkt zur Hand.',
    body: `<text x="86" y="0" class="eyebrow">AKTIVITÄTEN</text>
      <text x="86" y="88" class="h2">Abendrunde am Fluss</text>
      <text x="86" y="140" class="small">LAUFEN · HEUTE, 18:42 · NORDHEIM</text>
      <g transform="translate(62 190)"><rect width="966" height="305" rx="28" class="card"/><path d="M90 208 C170 190 160 140 246 152 S365 210 410 155 540 112 585 168 720 214 765 143 840 106 890 129" fill="none" stroke="#fc5200" stroke-width="12" stroke-linecap="round"/><circle cx="90" cy="208" r="11" fill="${white}"/><circle cx="890" cy="129" r="11" fill="${orange}"/><text x="32" y="54" class="label">STRECKENVERLAUF</text><text x="32" y="278" class="small">Strecke vereinfacht dargestellt</text></g>
      ${metricCard(62, 530, 'DISTANZ', '8,42', 'km')}${metricCard(558, 530, 'DAUER', '46:15', 'min')}
      ${metricCard(62, 720, 'TEMPO', '5:29', 'min/km')}${metricCard(558, 720, 'HÖHENMETER', '64', 'm')}
      <g transform="translate(62 920)"><rect width="966" height="216" rx="28" class="card"/><text x="32" y="57" class="h3">Kilometer-Splits</text><text x="32" y="112" class="small">KM</text><text x="254" y="112" class="small">ZEIT</text><text x="490" y="112" class="small">TEMPO</text><text x="740" y="112" class="small">PULS</text><path d="M32 132 H934 M32 182 H934" stroke="${line}"/><text x="32" y="169" class="body">1</text><text x="254" y="169" class="body">5:31</text><text x="490" y="169" class="body">5:31/km</text><text x="740" y="169" class="body">142 bpm</text></g>`
  },
  {
    slug: '03-physiologie',
    headline: 'Werte, die dein\nTraining einordnen.',
    subhead: 'Entwicklungen und Schätzungen verständlich erklärt.',
    body: `<text x="86" y="0" class="eyebrow">PHYSIOLOGIE</text>
      <text x="86" y="88" class="h2">Deine Entwicklung</text>
      <text x="86" y="140" class="small">PERSÖNLICHE TRAININGSWERTE</text>
      <g transform="translate(62 190)"><rect width="966" height="285" rx="28" class="card"/><text x="32" y="58" class="label">VDOT · LAUFTEMPO-SCHÄTZUNG</text><text x="32" y="160" class="big">45,2</text><text x="32" y="211" class="small">Aus geeigneten Läufen abgeleitet</text><path d="M450 222 L520 198 588 205 656 152 723 167 790 111 875 90" fill="none" stroke="${orange}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M450 235 L520 218 588 225 656 173 723 189 790 131 875 110 V250 H450Z" fill="#fc520022"/></g>
      <g transform="translate(62 510)"><rect width="966" height="170" rx="26" class="cardAlt"/><text x="32" y="58" class="label">VO₂MAX · MODELLSCHÄTZUNG</text><text x="32" y="122" class="h2">48 ml/kg/min</text><text x="570" y="122" class="small">Datenqualität: mittel</text></g>
      <g transform="translate(62 715)"><rect width="966" height="415" rx="26" class="card"/><text x="32" y="58" class="h3">Trainingsbereiche</text><text x="32" y="111" class="small">EASY / GRUNDLAGE</text><text x="710" y="111" class="body">5:55 – 6:30 /km</text><path d="M32 137 H934 M32 221 H934 M32 305 H934" stroke="${line}"/><text x="32" y="195" class="small">MARATHON / ZÜGIG</text><text x="710" y="195" class="body">5:00 – 5:20 /km</text><text x="32" y="279" class="small">THRESHOLD / SCHWELLE</text><text x="710" y="279" class="body">4:35 – 4:55 /km</text><text x="32" y="363" class="small">INTERVALL / VO₂MAX</text><text x="710" y="363" class="body">4:10 – 4:30 /km</text></g>`
  },
  {
    slug: '04-trophaeen',
    headline: 'Fortschritte,\ndie bleiben.',
    subhead: 'Sammle Trophäen und entdecke deine persönlichen Meilensteine.',
    body: `<text x="86" y="0" class="eyebrow">TROPHÄEN</text>
      <text x="86" y="88" class="h2">Deine Erfolge</text>
      <text x="86" y="140" class="small">JEDER SCHRITT ZÄHLT</text>
      <g transform="translate(62 190)"><rect width="966" height="202" rx="28" class="card"/><text x="32" y="61" class="label">FREIGESCHALTET</text><text x="32" y="151" class="big">18 <tspan class="small">von 42 Trophäen</tspan></text><rect x="610" y="91" width="300" height="17" rx="8" fill="#38383f"/><rect x="610" y="91" width="128" height="17" rx="8" fill="${orange}"/></g>
      ${trophyRow(62, 430, '🏅', 'Erste 100 Kilometer', 'DISTANZ · FREIGESCHALTET', 'Ein starkes Fundament gelegt.')}
      ${trophyRow(62, 638, '🌅', 'Früher Vogel', 'BESONDERE MOMENTE · FREIGESCHALTET', 'Laufen, wenn der Tag erwacht.')}
      ${trophyRow(62, 846, '🔥', 'Drei Wochen in Folge', 'KONSTANZ · IN ARBEIT', 'Bleib an drei Wochen dran.')}
      <g transform="translate(62 1080)"><rect width="966" height="84" rx="22" fill="#26150e" stroke="#733212"/><text x="32" y="53" class="body">Tippe auf eine Trophäe für Details und Historie.</text></g>`
  },
  {
    slug: '05-arena',
    headline: 'Gemeinsam läuft’s\nweiter.',
    subhead: 'Clubziele, Wochen-Champions und Teamfortschritt an einem Ort.',
    body: `<text x="86" y="0" class="eyebrow">DÜSEN-ARENA</text>
      <text x="86" y="88" class="h2">Diese Woche im Club</text>
      <text x="86" y="140" class="small">ZUSAMMEN UNTERWEGS</text>
      <g transform="translate(62 190)"><rect width="966" height="240" rx="28" class="card"/><text x="32" y="58" class="label">CLUB-CHALLENGE</text><text x="32" y="118" class="h3">Gemeinsam 1.000 km</text><text x="32" y="174" class="small">706,4 km erreicht · 70 %</text><rect x="32" y="198" width="900" height="16" rx="8" fill="#38383f"/><rect x="32" y="198" width="635" height="16" rx="8" fill="${orange}"/></g>
      <g transform="translate(62 474)"><rect width="966" height="690" rx="28" class="card"/><text x="32" y="62" class="h3">Wochenrangliste</text><text x="32" y="112" class="small">MITGLIED</text><text x="720" y="112" class="small">DISTANZ</text><path d="M32 137 H934" stroke="${line}"/>
        ${rankRow(158, '01', 'Läuferin A', '5 Aktivitäten', '42,8 km')}
        ${rankRow(265, '02', 'Läufer B', '4 Aktivitäten', '36,2 km')}
        ${rankRow(372, '03', 'Läuferin C', '4 Aktivitäten', '31,6 km')}
        ${rankRow(479, '04', 'Läufer D', '3 Aktivitäten', '25,1 km')}
        ${rankRow(586, '05', 'Läuferin E', '2 Aktivitäten', '18,4 km')}
      </g>`
  },
];

function activityCard(x, y, title, meta, distance, duration, pace) {
  return `<g transform="translate(${x} ${y})"><rect width="966" height="198" rx="25" class="card"/><circle cx="62" cy="65" r="27" fill="#32180f"/><path d="M49 71 L74 47 M62 47 H74 V59" fill="none" stroke="${orange}" stroke-width="6"/><text x="108" y="62" class="h3">${title}</text><text x="108" y="101" class="small">${meta}</text><path d="M32 125 H934" stroke="${line}"/><text x="32" y="171" class="body">${distance}</text><text x="345" y="171" class="body">${duration}</text><text x="675" y="171" class="body">${pace}</text></g>`;
}

function metricCard(x, y, label, value, unit) {
  return `<g transform="translate(${x} ${y})"><rect width="470" height="160" rx="24" class="card"/><text x="28" y="48" class="label">${label}</text><text x="28" y="110" class="h2">${value} <tspan class="small">${unit}</tspan></text></g>`;
}

function trophyRow(x, y, icon, title, meta, note) {
  return `<g transform="translate(${x} ${y})"><rect width="966" height="180" rx="25" class="card"/><text x="30" y="105" font-size="62">${icon}</text><text x="130" y="65" class="h3">${title}</text><text x="130" y="107" class="label">${meta}</text><text x="130" y="148" class="small">${note}</text><text x="907" y="100" class="h3" fill="${orange}">›</text></g>`;
}

function rankRow(y, rank, name, activities, distance) {
  return `<g transform="translate(32 ${y})"><circle cx="32" cy="32" r="26" fill="#302019"/><text x="32" y="39" class="tiny" text-anchor="middle">${rank}</text><text x="82" y="27" class="body">${name}</text><text x="82" y="61" class="small">${activities}</text><text x="680" y="42" class="body">${distance}</text><path d="M0 83 H902" stroke="${line}"/></g>`;
}

function screenshotSvg(screen, width, height) {
  const sx = width / 1080;
  const sy = height / 1920;
  const scale = Math.min(sx, sy);
  const top = 74 * scale;
  const contentX = 57 * scale;
  const mockupY = 610 * scale;
  const mockupH = 1190 * scale;
  const mockupW = 966 * scale;
  const mockupX = (width - mockupW) / 2;
  const bodyScale = (mockupW - 110 * scale) / 966;
  const bodyX = mockupX + (mockupW - 966 * bodyScale) / 2;
  const bodyY = mockupY + 56 * scale;
  const headlineLines = screen.headline.split('\n');
  const lineFont = 78 * scale;
  const headlineStart = top + 245 * scale;
  const headline = headlineLines.map((lineText, i) => `<text x="${contentX}" y="${headlineStart + i * lineFont}" class="headline">${lineText}</text>`).join('');
  const subhead = `<text x="${contentX}" y="${headlineStart + headlineLines.length * lineFont + 20 * scale}" class="subhead">${screen.subhead}</text>`;
  const body = `<g transform="translate(${bodyX} ${bodyY}) scale(${bodyScale})">${screen.body}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="back" x1="0" y1="0" x2="0.9" y2="1"><stop stop-color="#160c08"/><stop offset="0.48" stop-color="${bg}"/><stop offset="1" stop-color="#101014"/></linearGradient><radialGradient id="orb"><stop stop-color="#6b270d" stop-opacity=".60"/><stop offset="1" stop-color="#6b270d" stop-opacity="0"/></radialGradient><style>
      text{font-family:Arial,Helvetica,sans-serif;fill:${white}} .brand{font-size:${19*scale}px;font-weight:700;letter-spacing:${4*scale}px;fill:${orange}} .eyebrow{font-size:19px;font-weight:800;letter-spacing:4px;fill:${orange}} .headline{font-size:${72*scale}px;font-weight:800;letter-spacing:${-1*scale}px} .subhead{font-size:${26*scale}px;fill:${muted}} .h2{font-size:40px;font-weight:800;letter-spacing:-.5px} .h3{font-size:30px;font-weight:700} .big{font-size:66px;font-weight:800;letter-spacing:-1px;fill:${orange}} .body{font-size:23px;font-weight:700} .small{font-size:19px;fill:${muted}} .label{font-size:15px;font-weight:800;letter-spacing:2px;fill:${muted}} .tiny{font-size:16px;fill:${muted}} .card{fill:${panel};stroke:#303038;stroke-width:2} .cardAlt{fill:#151316;stroke:#4c2819;stroke-width:2}
    </style></defs>
    <rect width="${width}" height="${height}" fill="url(#back)"/><ellipse cx="${width*.9}" cy="${height*.14}" rx="${width*.45}" ry="${height*.16}" fill="url(#orb)"/>
    <g transform="translate(${contentX} ${top})">${logoSmall(0, 0, 44*scale)}<text x="${55*scale}" y="${32*scale}" class="brand">RUNCLUB NORDHEIM</text></g>
    ${headline}${subhead}
    <rect x="${mockupX}" y="${mockupY}" width="${mockupW}" height="${mockupH}" rx="${36*scale}" fill="#070708" stroke="#3b3b42" stroke-width="${3*scale}"/>
    <rect x="${mockupX}" y="${mockupY}" width="${mockupW}" height="${mockupH}" rx="${36*scale}" fill="${bg}"/>
    ${body}
    <g transform="translate(${contentX} ${height-80*scale})"><text class="small" y="0">Dorfdüsen · Runclub Nordheim</text><text class="small" x="${width-contentX*2}" y="0" text-anchor="end">${String(screens.indexOf(screen)+1).padStart(2,'0')} / 05</text></g>
  </svg>`;
  return svg;
}

if (process.argv.includes('--draft-screenshots')) {
  await Promise.all([draftIosDir, draftPlayDir].map((dir) => fs.mkdir(dir, { recursive: true })));
  for (const screen of screens) {
    await png(screenshotSvg(screen, 1290, 2796), path.join(draftIosDir, `${screen.slug}.png`), 1290, 2796);
    await png(screenshotSvg(screen, 1080, 1920), path.join(draftPlayDir, `${screen.slug}.png`), 1080, 1920);
  }
}

const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1b0d08"/><stop offset=".58" stop-color="#09090b"/><stop offset="1" stop-color="#151015"/></linearGradient><radialGradient id="glow"><stop stop-color="#fc5200" stop-opacity=".28"/><stop offset="1" stop-color="#fc5200" stop-opacity="0"/></radialGradient></defs>
  <rect width="1024" height="500" fill="url(#bg)"/><ellipse cx="830" cy="230" rx="350" ry="260" fill="url(#glow)"/>
  <path d="M570 420 C680 320 590 220 724 150 S882 99 1020 32" fill="none" stroke="#fc5200" stroke-opacity=".32" stroke-width="5" stroke-dasharray="5 20"/>
  <rect x="65" y="102" width="190" height="190" rx="48" fill="#1c100b" stroke="#87370f" stroke-width="5"/><g transform="translate(86 123) scale(.15)">${logoSvg(1024, orange)}</g>
  <text x="300" y="173" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="800" fill="#fafafa" letter-spacing="-2">Dorfdüsen</text>
  <text x="302" y="229" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" fill="#fc7a3d" letter-spacing="5">RUNCLUB NORDHEIM</text>
  <text x="302" y="310" font-family="Arial,Helvetica,sans-serif" font-size="32" fill="#d4d4d8">Dein Laufteam. Dein Fortschritt.</text>
  <text x="302" y="356" font-family="Arial,Helvetica,sans-serif" font-size="32" fill="#d4d4d8">Alles an einem Ort.</text>
  <g transform="translate(782 288) rotate(-14)"><rect width="150" height="92" rx="20" fill="#18181b" stroke="#3f3f46" stroke-width="2"/><path d="M26 64 L62 38 84 48 124 22" fill="none" stroke="#fc5200" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;
await png(feature, path.join(root, 'google-play-feature-graphic-1024x500.png'), 1024, 500);

console.log(`Store assets generated in ${root}`);
