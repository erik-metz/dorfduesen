import { inngest } from "../client";
import { db } from "@/lib/db";
import { syncUserActivities } from "@/lib/strava/sync";

export const syncAllUsersFunction = inngest.createFunction(
  {
    id: "daily-strava-sync",
    name: "Täglicher automatischer Strava Sync aller Athleten",
    triggers: [
      { cron: "TZ=Europe/Berlin 0 4 * * *" }, // Jeden Tag um 04:00 Uhr deutscher Zeit
      { event: "strava/sync.all" },
    ],
  },
  async ({ step }) => {
    // 1. Alle verknüpften Strava-Accounts aus der Datenbank abrufen
    const accounts = await step.run("get-connected-athletes", async () => {
      return await db.account.findMany({
        select: { userId: true },
      });
    });

    if (accounts.length === 0) {
      return { count: 0, message: "Keine verknüpften Strava-Accounts vorhanden." };
    }

    const results: Array<{ userId: string; success: boolean; count: number; error?: string }> = [];

    // 2. Jeden Athleten sequenziell synchronisieren (Token-Refresh geschieht automatisch bei Bedarf)
    for (const acc of accounts) {
      const res = await step.run(`sync-athlete-${acc.userId}`, async () => {
        return await syncUserActivities(acc.userId, 30);
      });
      results.push({ userId: acc.userId, ...res });
    }

    return {
      totalAthletes: accounts.length,
      syncedCount: results.reduce((sum, r) => sum + (r.count || 0), 0),
      results,
    };
  }
);
