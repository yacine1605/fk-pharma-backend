// routes/notification.routes.ts
import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { notifications } from "../../../db/schema";
import { db } from "../../../db/drizzle";
const router = Router();
router.get("/", async (_req, res, next) => {
    try {
        const result = await db
            .select()
            .from(notifications)
            .orderBy(desc(notifications.createdAt));
        return res.json({
            success: true,
            data: result,
        });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id/read", async (req, res, next) => {
    try {
        const [notification] = await db
            .update(notifications)
            .set({
            isRead: true,
        })
            .where(eq(notifications.id, req.params.id))
            .returning();
        return res.json({
            success: true,
            data: notification,
        });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=notification.routes.js.map