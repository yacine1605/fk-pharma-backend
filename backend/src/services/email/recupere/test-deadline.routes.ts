import { Router } from "express";
import {
  checkUpcomingDeadlines,
  checkExpiredDeadlines,
} from "./deadline-notifications.service.js";

const router: Router = Router();

router.post("/run-upcoming", async (_req, res) => {
  try {
    const result = await checkUpcomingDeadlines();
    return res.json({ success: true, result });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/run-expired", async (_req, res) => {
  try {
    const result = await checkExpiredDeadlines();
    return res.json({ success: true, result });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
