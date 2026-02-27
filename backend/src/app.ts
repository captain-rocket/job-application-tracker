import express from "express";
import { Pool } from "pg";

export function createApp(db: Pool) {
  const app = express();
  app.use(express.json());

  function requireDevKey(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const expected = process.env.DEV_KEY;
    if (!expected)
      return res.status(500).json({ error: "DEV_KEY not configured" });

    const provided = req.header("x-dev-key");
    if (provided !== expected)
      return res.status(400).json({ error: "Unauthorized" });

    next();
  }

  app.get("/private", requireDevKey, (req, res) => {
    res.json({ ok: true, message: "You reached a protected route" });
  });

  app.get("/health", (req, res) => {
    res.json({ status: true });
  });

  app.get("/tasks", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT id, title, completed, created_at FROM tasks ORDER BY id DESC",
      );
      res.json({ tasks: result.rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  app.post("/tasks", async (req, res) => {
    const title =
      typeof req.body?.title === "string" ? req.body?.title.trim() : "";
    if (!title) return res.status(400).json({ error: "title is required" });

    try {
      const result = await db.query(
        "INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, completed, created_at",
        [title],
      );
      res.status(201).json({ task: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: "Database insert failed" });
    }
  });

  app.patch("/tasks/:id", async (req, res) => {
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
        title = COALESCE($2, title),
        completed = COALESCE($3, completed)
      WHERE id = $1
      RETURNING id, title, completed, created_at
      `,
        [
          id,
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

  app.delete("/tasks/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    try {
      const result = await db.query(
        `DELETE FROM tasks WHERE id = $1 RETURNING id, title, completed, created_at`,
        [id],
      );
      res.json({ deleted: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database delete failed" });
    }
  });
  return app;
}
