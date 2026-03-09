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

  app.use(adminRoutes(db));
  app.use(authRoutes(db));
  app.use(healthRoutes());
  app.use(tasksRoutes(db));

  app.use(errorHandler);

  return app;
}
