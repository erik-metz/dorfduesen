export class InputError extends Error {}
type Body = Record<string, unknown>;
interface CoachBody {
  goalType?: string; title?: string; goalSubtype?: string; goalDescription?: string;
  notes?: string | null; preferredTerrain?: string;
  targetDate?: string; birthDate?: string; date?: string;
  weightKg?: number | string; heightCm?: number | string;
  restingHeartrate?: number | string; maxHeartrate?: number | string; vdotScore?: number | string;
  weeklyAvailability?: number | string; preferredLongRunDay?: number | string | null;
  targetDistance?: number | string; targetTimeSeconds?: number | string;
  includeSundayRun?: boolean;
}
const goals = ['5K', '10K', 'HALF_MARATHON', 'MARATHON', 'GENERAL_FITNESS', 'BASE_BUILD', 'FITNESS_BUILD', 'SPEED_IMPROVE', 'WEIGHT_LOSS', 'ROUTINE'];

export async function readCoachBody(request: Request, kind: 'plan' | 'profile' | 'metric'): Promise<CoachBody> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new InputError('Ungültiges JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Ein JSON-Objekt ist erforderlich.');
  const value = body as Body;
  if (kind === 'plan' && (typeof value.goalType !== 'string' || !goals.includes(value.goalType))) throw new InputError('Ungültiger Zieltyp.');
  const ranges: Record<string, [number, number, boolean?]> = {
    weightKg: [20, 400], heightCm: [80, 250], restingHeartrate: [25, 150, true],
    maxHeartrate: [80, 240, true], vdotScore: [10, 100], weeklyAvailability: [2, 6, true],
    preferredLongRunDay: [-1, 6, true], targetDistance: [1, 100], targetTimeSeconds: [60, 86400, true],
  };
  for (const [field, [min, max, integer]] of Object.entries(ranges)) {
    if (value[field] === undefined || value[field] === null || value[field] === '') continue;
    const raw = value[field];
    const number = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) throw new InputError(`${field}: gültiger Wert zwischen ${min} und ${max} erforderlich.`);
  }
  for (const field of ['title', 'goalSubtype', 'goalDescription', 'notes', 'preferredTerrain']) {
    if (value[field] === undefined || value[field] === null) continue;
    if (typeof value[field] !== 'string' || (value[field] as string).length > (field === 'title' ? 120 : 2000)) throw new InputError(`${field}: Text ist ungültig oder zu lang.`);
  }
  if (value.includeSundayRun !== undefined && typeof value.includeSundayRun !== 'boolean') throw new InputError('includeSundayRun muss ein Wahrheitswert sein.');
  if (value.preferredTerrain && !['ROAD', 'TRAIL', 'MIXED'].includes(String(value.preferredTerrain))) throw new InputError('Ungültiges Gelände.');
  for (const field of ['targetDate', 'birthDate', 'date']) {
    if (!value[field]) continue;
    if (typeof value[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value[field] as string)) throw new InputError(`${field}: ungültiges Datum.`);
    const date = new Date(value[field] as string);
    const dateOnly = (value[field] as string).slice(0, 10);
    if (!Number.isFinite(date.getTime()) || (new Date(`${dateOnly}T00:00:00Z`)).toISOString().slice(0, 10) !== dateOnly) throw new InputError(`${field}: ungültiges Datum.`);
    const daysAway = (date.getTime() - Date.now()) / 86400000;
    if (field === 'targetDate' && (daysAway < 41 || daysAway > 169)) throw new InputError('Zieldatum muss 6 bis 24 Wochen in der Zukunft liegen.');
    if (field !== 'targetDate' && (date.getUTCFullYear() < 1900 || daysAway > 1)) throw new InputError(`${field}: Datum liegt außerhalb des erlaubten Zeitraums.`);
  }
  if (value.maxHeartrate && value.restingHeartrate && Number(value.maxHeartrate) <= Number(value.restingHeartrate)) throw new InputError('Maximalpuls muss höher als Ruhepuls sein.');
  return value as CoachBody;
}
