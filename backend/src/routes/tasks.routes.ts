import { Router } from "express";
import { Pool } from "pg";
import { requireAuth, validateBody, validateParams } from "../middleware";
import {
  createTaskBodySchema,
  taskIdParamsSchema,
  updateTaskBodySchema,
  type TaskIdParams,
  type CreateTaskBody,
  type UpdateTaskBody,
} from "../schemas/task.schemas";

export function tasksRoutes(db: Pool) {
  const router = Router();

  router.use(requireAuth);

  router.get("/tasks", async (req, res, next) => {
    try {
      const result = await db.query(
        "SELECT id, title, completed, created_at FROM tasks WHERE user_id = $1 ORDER BY id DESC",
        [req.user!.id],
      );
      res.json({ tasks: result.rows });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/tasks",
    validateBody(createTaskBodySchema),
    async (req, res, next) => {
      const { title } = req.body as CreateTaskBody;

      try {
        const result = await db.query(
          "INSERT INTO tasks (user_id, title) VALUES ($1, $2) RETURNING id, title, completed, created_at",
          [req.user!.id, title],
        );
        res.status(201).json({ task: result.rows[0] });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/tasks/:id",
    validateParams(taskIdParamsSchema),
    validateBody(updateTaskBodySchema),
    async (req, res, next) => {
      const { id: idParam } = req.params as TaskIdParams;
      const id = Number(idParam);
      const { title: nextTitle, completed } = req.body as UpdateTaskBody;

      const shouldUpdateTitle = nextTitle !== undefined;
      const shouldUpdateCompleted = completed !== undefined;

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
            shouldUpdateTitle ? nextTitle : null,
            shouldUpdateCompleted ? completed : null,
          ],
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Task not found" });

        res.json({ task: result.rows[0] });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/tasks/:id",
    validateParams(taskIdParamsSchema),
    async (req, res, next) => {
      const { id: idParam } = req.params as TaskIdParams;
      const id = Number(idParam);

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
        next(error);
      }
    },
  );

  return router;
}
