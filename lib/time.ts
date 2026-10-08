const timeZone = 'Europe/Berlin';
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parts(date: Date) {
  return Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
}

export function dayKey(date = new Date()): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function shiftDay(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Calendar midnight, including daylight-saving transitions, independent of host TZ. */
export function berlinMidnight(key: string): Date {
  const target = Date.parse(`${key}T00:00:00Z`);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(guess));
    const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    guess += target - local;
  }
  return new Date(guess);
}

export function weekRange(date = new Date()) {
  const key = dayKey(date);
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  const startKey = shiftDay(key, -(weekday === 0 ? 6 : weekday - 1));
  return { key: startKey, start: berlinMidnight(startKey), end: berlinMidnight(shiftDay(startKey, 7)) };
}

export function monthRange(date = new Date()) {
  const key = dayKey(date).slice(0, 7);
  const next = new Date(`${key}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { key, start: berlinMidnight(`${key}-01`), end: berlinMidnight(`${next.toISOString().slice(0, 7)}-01`) };
}
