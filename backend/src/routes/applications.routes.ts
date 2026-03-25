import { Router } from "express";
import { Pool } from "pg";
import { requireAuth, validateBody, validateParams } from "../middleware";
import {
  applicationIdParamsSchema,
  createApplicationBodySchema,
  listApplicationsQuerySchema,
  updateApplicationBodySchema,
  type ApplicationIdParams,
  type CreateApplicationBody,
  type UpdateApplicationBody,
} from "../schemas/applications.schemas";

export function applicationsRoutes(db: Pool) {
  const router = Router();

  router.use(requireAuth);

  router.get("/applications", async (req, res, next) => {
    const { status, page, limit } = listApplicationsQuerySchema.parse(
      req.query,
    );
    const offset = (page - 1) * limit;

    const values: unknown[] = [req.user!.id];
    const whereClauses = ["user_id = $1"];

    if (status) {
      values.push(status);
      whereClauses.push(`status = $${values.length}`);
    }

    values.push(limit, offset);
    const limitParam = values.length - 1;
    const offsetParam = values.length;
    const countParams = [...values.slice(0, limitParam - 1)];

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
        updated_at,
        COUNT(*) OVER()::int AS total_count
        FROM applications
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY id DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
        `,
        values,
      );
      let total = result.rows[0]?.total_count ?? 0;

      if (result.rows.length === 0 && page > 1) {
        const countResult = await db.query(
          `
          SELECT COUNT(*)::int AS total_count
          FROM applications
          WHERE ${whereClauses.join(" AND ")}
          `,
          countParams,
        );
        total = countResult.rows[0]?.total_count ?? 0;
      }

      const applications = result.rows.map(
        ({ total_count, ...application }) => application,
      );

      res.status(200).json({
        applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/applications/:id",
    validateParams(applicationIdParamsSchema),
    async (req, res, next) => {
      const { id: idParam } = req.params as ApplicationIdParams;
      const id = Number(idParam);

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
    },
  );

  router.post(
    "/applications",
    validateBody(createApplicationBodySchema),
    async (req, res, next) => {
      const {
        company,
        job_title,
        status: providedStatus,
        job_url,
        location,
        notes,
        applied_at,
      } = req.body as CreateApplicationBody;

      const status = providedStatus ?? "saved";

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
            job_url ?? null,
            location ?? null,
            notes ?? null,
            applied_at ?? null,
          ],
        );
        res.status(201).json({ application: result.rows[0] });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/applications/:id",
    validateParams(applicationIdParamsSchema),
    validateBody(updateApplicationBodySchema),
    async (req, res, next) => {
      const { id: idParam } = req.params as ApplicationIdParams;
      const id = Number(idParam);
      const body = req.body as UpdateApplicationBody;

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fields = [
        "company",
        "job_title",
        "status",
        "job_url",
        "location",
        "notes",
        "applied_at",
      ] as const satisfies ReadonlyArray<keyof UpdateApplicationBody>;

      for (const field of fields) {
        const value = body[field];
        if (value !== undefined) {
          updates.push(`${field} = $${paramIndex++}`);
          values.push(value);
        }
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
    },
  );

  router.delete(
    "/applications/:id",
    validateParams(applicationIdParamsSchema),
    async (req, res, next) => {
      const { id: idParam } = req.params as ApplicationIdParams;
      const id = Number(idParam);

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
    },
  );

  return router;
}
