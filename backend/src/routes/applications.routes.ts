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

const DEMO_APPLICATION_CAP = 10;
const DEMO_APPLICATIONS_TO_KEEP = 3;

type DemoCleanupNotice = {
  code: "demo_application_cleanup";
  message: string;
};

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
  created_at: string;
  updated_at: string;
};

type CreateApplicationResponseBody = {
  application: ApplicationResponseRow;
  notice?: DemoCleanupNotice;
};

async function isPublicDemoUser(
  db: Pool,
  userId: string,
  demoUserEmail: string,
): Promise<boolean> {
  const result = await db.query(
    `
    SELECT id
    FROM users
    WHERE id = $1 AND LOWER(email) = $2 AND role = 'user'
    `,
    [userId, demoUserEmail],
  );

  return Boolean(result.rowCount && result.rowCount > 0);
}

async function cleanupDemoApplicationsIfNeeded(
  db: Pool,
  userId: string,
): Promise<DemoCleanupNotice | null> {
  const countResult = await db.query(
    "SELECT COUNT(*)::int AS total FROM applications WHERE user_id = $1",
    [userId],
  );
  const total = countResult.rows[0]?.total ?? 0;

  if (total <= DEMO_APPLICATION_CAP) return null;

  const deleteResult = await db.query(
    `
  DELETE FROM applications
  WHERE user_id = $1
    AND id NOT IN (
    SELECT id
    FROM applications
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT $2
    )
  `,
    [userId, DEMO_APPLICATIONS_TO_KEEP],
  );

  const deletedCount = deleteResult.rowCount ?? 0;

  return {
    code: "demo_application_cleanup",
    message: `Demo account cleanup ran after reaching ${DEMO_APPLICATION_CAP} applications. Kept the newest ${DEMO_APPLICATIONS_TO_KEEP} applications and removed ${deletedCount} older demo applications.`,
  };
}

async function getCleanupDemoNotice(
  db: Pool,
  userId: string,
): Promise<DemoCleanupNotice | null> {
  const { publicDemoUserEmail } = getPublicAccessEnv();

  if (!publicDemoUserEmail) return null;

  const isDemoUser = await isPublicDemoUser(db, userId, publicDemoUserEmail);
  if (!isDemoUser) return null;

  return cleanupDemoApplicationsIfNeeded(db, userId);
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

        const application = result.rows[0] as ApplicationResponseRow;
        const notice = await getCleanupDemoNotice(db, req.user!.id);
        const responseBody: CreateApplicationResponseBody = { application };

        if (notice) {
          responseBody.notice = notice;
        }

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
