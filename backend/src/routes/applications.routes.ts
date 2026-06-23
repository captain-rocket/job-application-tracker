import { getPublicAccessEnv } from "../config/env";
import { Router } from "express";
import { Pool } from "pg";
import {
  requireAuth,
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware";
import {
  applicationIdParamsSchema,
  createApplicationBodySchema,
  listApplicationsQuerySchema,
  updateApplicationBodySchema,
  type ApplicationIdParams,
  type ListApplicationsQuery,
  type CreateApplicationBody,
  type UpdateApplicationBody,
} from "../schemas/applications.schemas";

type ApplicationStatus = NonNullable<CreateApplicationBody["status"]>;

type ApplicationResponseRow = {
  id: number;
  company: string;
  job_title: string;
  status: ApplicationStatus;
  job_url: string | null;
  location: string | null;
  notes: string | null;
  applied_at: string | null;
  is_demo_seed: boolean;
  created_at: string;
  updated_at: string;
};

type CreateApplicationResponseBody = {
  application: ApplicationResponseRow;
};

const DEMO_CREATED_APPLICATION_TOTAL_CAP = 50;
const DEMO_CREATE_BURST_CAP = 5;

type DemoCreateLimitStatus =
  | "not_demo_user"
  | "allowed"
  | "total_limit_reached"
  | "burst_limit_reached";

async function getDemoCreateLimitStatus(
  db: Pool,
  user: { id: string; role: "user" | "admin" },
): Promise<DemoCreateLimitStatus> {
  const { publicDemoUserEmail } = getPublicAccessEnv();

  if (!publicDemoUserEmail || user.role !== "user") return "not_demo_user";

  const result = await db.query(
    `
    SELECT
      u.id,
      COUNT(a.id) FILTER (WHERE a.is_demo_seed = false)::int AS total_created,
      COUNT(a.id) FILTER (
        WHERE a.is_demo_seed = false
          AND a.created_at >= NOW() - INTERVAL '10 minutes'
      )::int AS recent_created
    FROM users u
    LEFT JOIN applications a ON a.user_id = u.id
    WHERE u.id = $1
      AND LOWER(u.email) = $2
      AND u.role = 'user'
    GROUP BY u.id
    `,
    [user.id, publicDemoUserEmail],
  );

  if (!result.rows[0]) return "not_demo_user";

  const row = result.rows[0] as {
    total_created: number;
    recent_created: number;
  };

  if (row.total_created >= DEMO_CREATED_APPLICATION_TOTAL_CAP) {
    return "total_limit_reached";
  }

  if (row.recent_created >= DEMO_CREATE_BURST_CAP) {
    return "burst_limit_reached";
  }

  return "allowed";
}

export function applicationsRoutes(db: Pool) {
  const router = Router();

  router.use(requireAuth);

  router.get(
    "/applications",
    validateQuery(listApplicationsQuerySchema),
    async (req, res, next) => {
      const query = req.query as unknown as ListApplicationsQuery;
      const { status, page, limit } = query;

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
        is_demo_seed,
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
    },
  );

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
          is_demo_seed,
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
        const demoCreateLimitStatus = await getDemoCreateLimitStatus(
          db,
          req.user!,
        );

        if (demoCreateLimitStatus === "total_limit_reached") {
          return res
            .status(403)
            .json({ error: "Demo account create limit reached." });
        }

        if (demoCreateLimitStatus === "burst_limit_reached") {
          return res
            .status(429)
            .json({ error: "Please wait before creating more demo records." });
        }

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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING 
          id,
          company,
          job_title,
          status,
          job_url,
          location,
          notes,
          applied_at,
          is_demo_seed,
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

        const responseBody: CreateApplicationResponseBody = {
          application: result.rows[0] as ApplicationResponseRow,
        };

        res.status(201).json(responseBody);
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
          AND is_demo_seed = false
        RETURNING
        id,
        company,
        job_title,
        status,
        job_url,
        location,
        notes,
        applied_at,
        is_demo_seed,
        created_at,
        updated_at
        `,
          values,
        );

        if (!result.rows[0]) {
          const existing = await db.query(
            `
            SELECT id, is_demo_seed
            FROM applications
            WHERE id = $1 AND user_id = $2
            `,
            [id, req.user!.id],
          );

          if (existing.rows[0]?.is_demo_seed === true) {
            return res
              .status(403)
              .json({
                error: "Protected demo seed applications cannot be edited",
              });
          }

          return res.status(404).json({ error: "Application not found" });
        }

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
          AND is_demo_seed = false
        RETURNING id
        `,
          [id, req.user!.id],
        );

        if (!result.rows[0]) {
          const existing = await db.query(
            `
            SELECT id, is_demo_seed
            FROM applications
            WHERE id = $1 AND user_id = $2
            `,
            [id, req.user!.id],
          );

          if (existing.rows[0]?.is_demo_seed === true) {
            return res
              .status(403)
              .json({
                error: "Protected demo seed applications cannot be deleted",
              });
          }

          return res.status(404).json({ error: "Application not found" });
        }

        res.status(200).json({ message: "Application deleted" });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
