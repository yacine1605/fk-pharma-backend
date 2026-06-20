/**
 * deadline.cron.ts
 * Intégration des notifications dates butoir dans le système de cron
 */

import cron from "node-cron";
import {
  checkUpcomingDeadlines,
  checkExpiredDeadlines,
} from "./deadline-notifications.service";

const DEADLINE_CHECK_SCHEDULE = "0 8 * * *"; // Tous les jours à 8h
const EXPIRED_CHECK_SCHEDULE = "0 9 * * *";  // Tous les jours à 9h

/**
 * Démarre les cron jobs pour les notifications de dates butoir
 */
export function startDeadlineCron() {
  // ── Vérification des échéances à venir (8h du matin) ──
  cron.schedule(DEADLINE_CHECK_SCHEDULE, async () => {
    console.log("[CRON] Checking upcoming deadlines...");
    try {
      const result = await checkUpcomingDeadlines();
      console.log(
        `[CRON] Deadline check complete: ${result.notificationsCreated} notifications created`,
      );
    } catch (error) {
      console.error("[CRON] Deadline check failed:", error);
    }
  });

  // ── Vérification des dates dépassées (9h du matin) ──
  cron.schedule(EXPIRED_CHECK_SCHEDULE, async () => {
    console.log("[CRON] Checking expired deadlines...");
    try {
      const result = await checkExpiredDeadlines();
      console.log(
        `[CRON] Expired check complete: ${result.expiredCount} expired deadlines found`,
      );
    } catch (error) {
      console.error("[CRON] Expired check failed:", error);
    }
  });

  console.log("[CRON] Deadline notification cron jobs started");
  console.log(`  - Upcoming deadlines: ${DEADLINE_CHECK_SCHEDULE}`);
  console.log(`  - Expired deadlines: ${EXPIRED_CHECK_SCHEDULE}`);
}
