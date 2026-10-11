import { inngest } from "../client";
import { db } from "@/lib/db";

export const syncAllUsersFunction = inngest.createFunction(
  {
    id: "daily-strava-sync",
    name: "Automatischer Strava Sync aller Athleten",
    triggers: [
      // Auch Aktivitäten nach dem morgendlichen Lauf zeitnah abholen.
      // 30 Minuten halten die API-Last für alle verknüpften Accounts begrenzt.
      { cron: "TZ=Europe/Berlin */30 * * * *" },
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
