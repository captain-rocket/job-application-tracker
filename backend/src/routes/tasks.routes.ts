import { Router } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/requireAuth";

export function tasksRoutes(db: Pool) {
  const router = Router();

  router.use(requireAuth);

  router.get("/tasks", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT id, title, completed, created_at FROM tasks WHERE user_id = $1 ORDER BY id DESC",
        [req.user!.id],
      );
      res.json({ tasks: result.rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  router.post("/tasks", async (req, res) => {
    const title =
      typeof req.body?.title === "string" ? req.body?.title.trim() : "";
    if (!title) return res.status(400).json({ error: "title is required" });

    try {
      const result = await db.query(
        "INSERT INTO tasks (user_id, title) VALUES ($1, $2) RETURNING id, title, completed, created_at",
        [req.user!.id, title],
      );
      res.status(201).json({ task: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: "Database insert failed" });
    }
  });

  router.patch("/tasks/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const hasTitle = typeof req.body?.title == "string";
    const hasCompleted = typeof req.body?.completed === "boolean";
    if (!hasTitle && !hasCompleted) {
      return res.status(400).json({ error: "Provide title and/or completed" });
    }

    const title = hasTitle ? req.body?.title.trim() : undefined;
    if (hasTitle && !title)
      return res.status(400).json({ error: "title cannot be empty" });

    try {
      const result = await db.query(
        `
      UPDATE tasks
      SET
        title = COALESCE($3, title),
        completed = COALESCE($4, completed)
      WHERE id = $1 AND user_id = $2
      RETURNING id, title, completed, created_at
      `,
        [
          id,
          req.user!.id,
          hasTitle ? title : null,
          hasCompleted ? req.body?.completed : null,
        ],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Task not found" });

      res.json({ task: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database update failed" });
    }
  });

  router.delete("/tasks/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    try {
      const result = await db.query(
        `DELETE FROM tasks
         WHERE id = $1 AND user_id = $2
         RETURNING id, title, completed, created_at`,
        [id, req.user!.id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ deleted: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database delete failed" });
    }
  });

  return router;
}
