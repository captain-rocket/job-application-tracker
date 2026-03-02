import { Router } from "express";

export function healthRoutes() {
  const router = Router();
  router.get("/health", (req, res) => {
    res.json({ status: true });
  });
  return router;
}
