import { Router } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export function adminRoutes(db: Pool) {
  const router = Router();

  router.get(
    "/admin/users",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const result = await db.query(
          "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC",
        );
        res.json({ users: result.rows });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load users" });
      }
    },
  );
  return router;
}
