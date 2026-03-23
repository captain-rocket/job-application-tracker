import express from "express";

import { Pool } from "pg";
import {
  adminRoutes,
  applicationsRoutes,
  authRoutes,
  healthRoutes,
  tasksRoutes,
} from "./routes";

import { errorHandler } from "./middleware";

export function createApp(db: Pool) {
  const app = express();

  app.use(express.json());

  app.use(healthRoutes());
  app.use(authRoutes(db));

  app.use(tasksRoutes(db));
  app.use(applicationsRoutes(db));
  app.use(adminRoutes(db));

  app.use(errorHandler);

  return app;
}
