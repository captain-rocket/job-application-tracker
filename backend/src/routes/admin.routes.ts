import { Router } from "express";
import { Pool } from "pg";
import { requireAuth, requireRole } from "../middleware";

export function adminRoutes(db: Pool) {
  const router = Router();

  router.get(
    "/admin/users",
    requireAuth,
    requireRole("admin"),
    async (req, res, next) => {
      try {
        const result = await db.query(
          "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC",
        );
        res.json({ users: result.rows });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
