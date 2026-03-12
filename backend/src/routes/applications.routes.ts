import { Router } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/requireAuth";
import { getTrimmedString } from "../utils/helpers";

export function applicationsRoutes(db: Pool) {
  const router = Router();

  router.use(requireAuth);

  router.get("/applications", async (req, res, next) => {
    try {
      const result = await db.query(
        `
        SELECT
        id,
        company,
        job_title,
        status,
        job_url,
        location,
        notes,
        applied_at,
        created_at,
        updated_at
        FROM applications
        WHERE user_id = $1
        ORDER BY id DESC
        `,
        [req.user!.id],
      );
      res.status(200).json({ applications: result.rows })
    } catch (error) {
      next(error);
    }
  });

  router.post("/applications", async (req, res, next) => {
    const company = getTrimmedString(req.body?.company) ?? "";

    const job_title = getTrimmedString(req.body?.job_title) ?? "";

    const allowedStatuses = new Set([
      "saved",
      "applied",
      "interviewing",
      "offer",
      "rejected",
      "withdrawn",
    ]);

    const status = getTrimmedString(req.body?.status) ?? "saved";

    const job_url = getTrimmedString(req.body?.job_url);

    const location = getTrimmedString(req.body?.location);

    const notes = getTrimmedString(req.body?.notes);

    const applied_at = getTrimmedString(req.body?.applied_at);

    if (!company) return res.status(400).json({ error: "company is required" });

    if (!job_title)
      return res.status(400).json({ error: "job_title is required" });

    if (!allowedStatuses.has(status))
      return res.status(400).json({ error: "Invalid status" });

    try {
      const result = await db.query(
        `
          INSERT INTO applications (
          user_id,
          company,
          job_title,
          status,
          job_url,
          location,
          notes,
          applied_at
      )
          VALUES ($1, $2, $3, $4,$5, $6, $7, $8)
          RETURNING 
          id,
          company,
          job_title,
          status,
          job_url,
          location,
          notes,
          applied_at,
          created_at,
          updated_at
          `,
        [
          req.user!.id,
          company,
          job_title,
          status,
          job_url,
          location,
          notes,
          applied_at,
        ],
      );
      res.status(201).json({ application: result.rows[0] });

    } catch (error) {
      next(error);
    }
  });
  return router;
}
