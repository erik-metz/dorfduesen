import { db } from '@/lib/db';
import { getWeeklyChampions, getStartOfWeek, getWeekKey, ChampionTitle } from './stats';

export interface TitleChangeResult {
  titleId: string;
  titleName: string;
  icon: string;
  previousHolder?: {
    userId: string;
    name?: string;
    value: number;
  } | null;
  newHolder: {
    userId: string;
    name: string;
    value: number;
    formattedValue: string;
  };
  overtaken: boolean;
}

/**
 * Evaluates current weekly champions and checks if any title holder was dethroned/overtaken.
 * When a title changes hands (e.g. someone lost "Die Bergziege"), creates a TITLE_LOST notification
 * for the previous leader, and a TITLE_GAINED notification for the new leader.
 */
export async function checkWeeklyTitleChanges(refDate: Date = new Date()): Promise<TitleChangeResult[]> {
  const startOfWeek = getStartOfWeek(refDate);
  const weekKey = getWeekKey(refDate);

  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('arena'), hashtext(${weekKey}))::text`;
    // 1. Compute current leaders for the 6 weekly titles
    const champions: ChampionTitle[] = await getWeeklyChampions(startOfWeek);

    // 2. Fetch existing recorded title holders for this week
    const existingHolders = await tx.weeklyTitleHolder.findMany({
      where: { weekKey },
      include: {
        user: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            username: true,
          },
        },
      },
    });

    const existingMap = new Map<string, (typeof existingHolders)[number]>();
    for (const h of existingHolders) {
      existingMap.set(h.titleId, h);
    }

    const results: TitleChangeResult[] = [];

    for (const champ of champions) {
      if (champ.recipients) continue; // New shared awards have no dethroning notifications.
      if (!champ.winner || champ.winner.value <= 0) {
        continue;
      }

      const currentWinner = champ.winner;
      const existing = existingMap.get(champ.id);
      if (existing?.isFinalized) continue;

      if (!existing) {
        // First time someone claims this title in the current week
        await tx.weeklyTitleHolder.create({
          data: {
            weekKey,
            titleId: champ.id,
            userId: currentWinner.userId,
            value: currentWinner.value,
          },
        });

        // Initial claim notification
        await tx.notification.create({
          data: {
            userId: currentWinner.userId,
            type: 'TITLE_GAINED',
            title: `${champ.icon} Neue Führung: ${champ.title}!`,
            message: `Du hast diese Woche mit ${currentWinner.formattedValue} die Führung bei "${champ.title}" übernommen!`,
            link: '/arena',
            metadata: {
              titleId: champ.id,
              championTitle: champ.title,
              icon: champ.icon,
              newValue: currentWinner.value,
              formattedValue: currentWinner.formattedValue,
            },
          },
        });

        results.push({
          titleId: champ.id,
          titleName: champ.title,
          icon: champ.icon,
          previousHolder: null,
          newHolder: currentWinner,
          overtaken: false,
        });
      } else if (existing.userId !== currentWinner.userId) {
        // OVERTAKEN! The title has been taken away from previous holder!
        const prevUser = existing.user;
        const prevUserName =
          [prevUser.firstname, prevUser.lastname].filter(Boolean).join(' ') ||
          prevUser.username ||
          'Athlet';

        // Customized message for each title
        const dethronedMessages: Record<string, string> = {
          elevation: `${currentWinner.name} hat dir mit ${currentWinner.formattedValue} den Titel "Die Bergziege" abgenommen! Zeit für Höhenmeter im Ried! ⛰️`,
          distance: `${currentWinner.name} hat dich überholt und dir mit ${currentWinner.formattedValue} die Kilometer-Krone abgenommen! 👑`,
          time: `${currentWinner.name} hat mehr Bewegungszeit gesammelt (${currentWinner.formattedValue}) und dir den Ausdauer-Büffel abgelaufen! ⏱️`,
          heartrate: `${currentWinner.name} hat mit ${currentWinner.formattedValue} Puls die Führung bei der Eisenlunge übernommen! 💓`,
          early_bird: `${currentWinner.name} war früher wach und hat dir mit ${currentWinner.formattedValue} vor 08:00 Uhr den Frühaufsteher stibitzt! 🌅`,
          consistency: `${currentWinner.name} hat mit ${currentWinner.formattedValue} den Titel "Dauer-Düser" übernommen! 📅`,
        };

        const lostMsg =
          dethronedMessages[champ.id] ||
          `${currentWinner.name} hat dich überholt und dir mit ${currentWinner.formattedValue} den Titel "${champ.title}" abgenommen!`;

        // 1. Notify the dethroned athlete
        await tx.notification.create({
          data: {
            userId: existing.userId,
            type: 'TITLE_LOST',
            title: `${champ.icon} ${champ.title} verloren!`,
            message: lostMsg,
            link: '/arena',
            metadata: {
              titleId: champ.id,
              championTitle: champ.title,
              icon: champ.icon,
              previousValue: existing.value,
              newValue: currentWinner.value,
              formattedValue: currentWinner.formattedValue,
              overtakenByUserId: currentWinner.userId,
              overtakenByName: currentWinner.name,
            },
          },
        });

        // 2. Notify the new champion
        await tx.notification.create({
          data: {
            userId: currentWinner.userId,
            type: 'TITLE_GAINED',
            title: `${champ.icon} Neuer Champion: ${champ.title}!`,
            message: `Starke Leistung! Du hast ${prevUserName} überholt und dir mit ${currentWinner.formattedValue} "${champ.title}" geschnappt!`,
            link: '/arena',
            metadata: {
              titleId: champ.id,
              championTitle: champ.title,
              icon: champ.icon,
              previousHolderUserId: existing.userId,
              previousHolderName: prevUserName,
              newValue: currentWinner.value,
              formattedValue: currentWinner.formattedValue,
            },
          },
        });

        // 3. Update the record to reflect the new champion
        await tx.weeklyTitleHolder.update({
          where: { id: existing.id },
          data: {
            userId: currentWinner.userId,
            value: currentWinner.value,
          },
        });

        results.push({
          titleId: champ.id,
          titleName: champ.title,
          icon: champ.icon,
          previousHolder: {
            userId: existing.userId,
            name: prevUserName,
            value: existing.value,
          },
          newHolder: currentWinner,
          overtaken: true,
        });
      } else {
        // Same user is still champion; update their score if it changed
        if (existing.value !== currentWinner.value) {
          await tx.weeklyTitleHolder.update({
            where: { id: existing.id },
            data: {
              value: currentWinner.value,
            },
          });
        }

        results.push({
          titleId: champ.id,
          titleName: champ.title,
          icon: champ.icon,
          previousHolder: {
            userId: existing.userId,
            value: existing.value,
          },
          newHolder: currentWinner,
          overtaken: false,
        });
      }
    }

    return results;
  }, { timeout: 30000 });
}
