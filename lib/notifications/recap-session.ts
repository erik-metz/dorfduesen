const shownRecaps = new Set<string>();
const storageKey = 'dorfdusen:weekly-recap:v1';

/** Claim before opening so remounts and slow read receipts cannot reopen it. */
export function claimWeeklyRecap(id: string): boolean {
  if (shownRecaps.has(id)) return false;
  shownRecaps.add(id);
  try {
    if (sessionStorage.getItem(storageKey) === id) return false;
    sessionStorage.setItem(storageKey, id);
  } catch {
    // Private browsing or disabled storage still has the in-memory guard.
  }
  return true;
}
