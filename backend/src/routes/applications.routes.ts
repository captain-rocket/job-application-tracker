import { Router } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware";
import { getTrimmedString } from "../utils/helpers";

export function applicationsRoutes(db: Pool) {
  const router = Router();

  router.use(requireAuth);

  const allowedStatuses = new Set([
    "saved",
    "applied",
    "interviewing",
    "offer",
    "rejected",
    "withdrawn",
  ]);

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
      res.status(200).json({ applications: result.rows });
    } catch (error) {
      next(error);
    }
  });

  router.get("/applications/:id", async (req, res, next) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "Invalid application id" });
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
          WHERE id = $1 AND user_id = $2
          `,
        [id, req.user!.id],
      );

      if (!result.rows[0])
        return res.status(404).json({ error: "Application not found" });

      res.status(200).json({ application: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.post("/applications", async (req, res, next) => {
    const company = getTrimmedString(req.body?.company) ?? "";

    const job_title = getTrimmedString(req.body?.job_title) ?? "";

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

  router.patch("/applications/:id", async (req, res, next) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "Invalid application id" });

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (Object.hasOwn(body, "company")) {
      const company = getTrimmedString(body.company);
      if (!company)
        return res.status(400).json({ error: "company cannot be empty" });
      updates.push(`company = $${paramIndex++}`);
      values.push(company);
    }

    if (Object.hasOwn(body, "job_title")) {
      const job_title = getTrimmedString(body.job_title);
      if (!job_title)
        return res.status(400).json({ error: "job_title cannot be empty" });
      updates.push(`job_title = $${paramIndex++}`);
      values.push(job_title);
    }

    if (Object.hasOwn(body, "status")) {
      const status = getTrimmedString(body.status);

      if (!status || !allowedStatuses.has(status))
        return res.status(400).json({ error: "Invalid status" });

      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (Object.hasOwn(body, "job_url")) {
      const job_url = getTrimmedString(body.job_url);

      updates.push(`job_url = $${paramIndex++}`);
      values.push(job_url);
    }

    if (Object.hasOwn(body, "location")) {
      const location = getTrimmedString(body.location);
      updates.push(`location = $${paramIndex++}`);
      values.push(location);
    }

    if (Object.hasOwn(body, "notes")) {
      const notes = getTrimmedString(body.notes);
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (Object.hasOwn(body, "applied_at")) {
      const applied_at = getTrimmedString(body.applied_at);
      updates.push(`applied_at = $${paramIndex++}`);
      values.push(applied_at);
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid fields provided for update" });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, req.user!.id);

    try {
      const result = await db.query(
        `
        UPDATE applications
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
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
        values,
      );

      if (!result.rows[0])
        return res.status(404).json({ error: "Application not found" });

      res.status(200).json({ application: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/applications/:id", async (req, res, next) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "Invalid application id" });

    try {
      const result = await db.query(
        `
        DELETE FROM applications
        WHERE id = $1 AND user_id = $2
        RETURNING id
        `,
        [id, req.user!.id],
      );

      if (!result.rows[0])
        return res.status(404).json({ error: "Application not found" });

      res.status(200).json({ message: "Application deleted" });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
