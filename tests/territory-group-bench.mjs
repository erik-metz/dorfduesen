// Local benchmark (not part of npm test): two group runs of 15 runners with GPS noise, then an outsider.
// Usage: node tests/territory-group-bench.mjs   (NO_OUTSIDER=1 to inspect shared ownership)
import { loadTs } from './load-ts.mjs';
const { replayClaims } = loadTs('lib/territory/engine.ts');
function noisyLoop(seed, cx = 8.38, cy = 49.69, rx = .012, ry = .008) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - .5; };
  const ring = [];
  for (let k = 0; k < 400; k++) {
    const a = 2 * Math.PI * k / 400;
    ring.push([cx + rx * Math.cos(a) + rnd() * 1e-4, cy + ry * Math.sin(a) + rnd() * 7e-5]);
  }
  ring.push([...ring[0]]);
  return { type: 'Polygon', coordinates: [ring] };
}
const base = Date.UTC(2026, 10, 20, 9, 0);
const claims = [];
for (let i = 0; i < 15; i++) claims.push({ id: `g${String(i).padStart(2, '0')}`, userId: `runner-${i}`,
  startedAt: new Date(base + i * 20000).toISOString(), endedAt: new Date(base + 3600000 + i * 30000).toISOString(), geometry: noisyLoop(i + 1) });
// A second group run a week later and some outsider rounds.
for (let i = 0; i < 15; i++) claims.push({ id: `h${String(i).padStart(2, '0')}`, userId: `runner-${i}`,
  startedAt: new Date(base + 7 * 86400000 + i * 20000).toISOString(), endedAt: new Date(base + 7 * 86400000 + 3600000 + i * 30000).toISOString(), geometry: noisyLoop(100 + i) });
if (!process.env.NO_OUTSIDER) claims.push({ id: 'z1', userId: 'outsider', startedAt: new Date(base + 9 * 86400000).toISOString(), endedAt: new Date(base + 9 * 86400000 + 4000000).toISOString(), geometry: noisyLoop(999, 8.38, 49.69, .016, .011) });
const t0 = performance.now();
const state = replayClaims(claims);
const ms = performance.now() - t0;
const owners = new Map();
for (const t of state.territories) for (const u of t.ownerIds ?? [t.userId]) owners.set(u, (owners.get(u) ?? 0) + t.areaM2);
console.log(JSON.stringify({ ms: Math.round(ms), territories: state.territories.length, events: state.events.length,
  tiny: state.territories.filter(t => t.areaM2 < 10000).length, owners: [...owners].map(([u, a]) => `${u}:${(a / 1e6).toFixed(3)}`).slice(0, 20) }, null, 1));
