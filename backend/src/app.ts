import express from "express";
import { Pool } from "pg";
import { adminRoutes } from "./routes/admin.routes";
import { authRoutes } from "./routes/auth.routes";
import { healthRoutes } from "./routes/health.routes";
import { tasksRoutes } from "./routes/tasks.routes";
import { errorHandler } from "./middleware/errorHandler";

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
      return res.status(401).json({ error: "Unauthorized" });

    next();
  }

  app.get("/private", requireDevKey, (req, res) => {
    res.json({ ok: true, message: "You reached a protected route" });
  });

  app.use(adminRoutes(db));
  app.use(authRoutes(db));
  app.use(healthRoutes());
  app.use(tasksRoutes(db));

  app.use(errorHandler);

  return app;
}
