import { inngest } from "../client";
import { db } from "@/lib/db";

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

    await step.sendEvent('queue-athletes', accounts.map(acc => ({
      name: 'strava/sync.requested', data: { userId: acc.userId },
    })));
    return { totalAthletes: accounts.length, queued: true };
  }
);
