import bcrypt from "bcryptjs";
import { createDbPool } from "../config/db";

/**
 * Seed script goals:
 * - Create (or update) a known admin user + normal user
 * - Insert a deterministic set of tasks for each user
 * - Insert a deterministic set of application records for the standard user
 * - Be safe to re-run for local development verification
 *
 * How it works:
 * - Upsert users by email (so re-running doesn't create duplicates)
 * - Delete seeded tasks for each user and reinsert them
 * - Delete existing applications for the seeded standard user and reinsert them
 */

async function main() {
  const pool = createDbPool();

  const users = [
    {
      email: "admin@example.com",
      password: "AdminPass123!",
      role: "admin" as const,
      tasks: ["Review user list", "Check failed jobs", "Audit task ownership"],
      applications: [],
    },
    {
      email: "user@example.com",
      password: "UserPass123!",
      role: "user" as const,
      tasks: ["Apply to 3 roles", "Refactor tests", "Push updates to GitHub"],
      applications: [
        {
          company: "North Field Labs",
          job_title: "Frontend Engineer",
          status: "saved",
          job_url: null,
          location: "Remote",
          notes: "Local fronted seed: saved application",
          applied_at: null,
        },
        {
          company: "Sans Tech Systems",
          job_title: "Full Stack Developer",
          status: "applied",
          job_url: "https://jobs.sanstechsystems.example/full-stack-developer",
          location: "Columbus, OH",
          notes: "Local frontend seed: applied application",
          applied_at: "2026-04-10T14:30:00.000Z",
        },
        {
          company: "Target AI",
          job_title: "Software Engineer",
          status: "interviewing",
          job_url: "https://careers.target-ai.example/software-engineer",
          location: null,
          notes: "Local frontend seed: interviewing application",
          applied_at: "2026-04-02T09:00:00.000Z",
        },
      ],
    },
  ];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const u of users) {
      const passwordHash = await bcrypt.hash(u.password, 10);

      const upsertUser = await client.query(
        `
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (email)
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
        RETURNING id, email, role 
        `,
        [u.email, passwordHash, u.role],
      );

      const userRow = upsertUser.rows[0];
      const userId = userRow.id as string;

      await client.query(`DELETE FROM tasks WHERE user_id = $1`, [userId]);

      for (const title of u.tasks) {
        await client.query(
          `
          INSERT INTO tasks (user_id, title, completed)
          VALUES ($1, $2, false)
          `,
          [userId, title],
        );
      }

      if (u.applications.length > 0) {
        await client.query(
          `
          DELETE FROM applications
          WHERE user_id = $1
          `,
          [userId],
        );

        for (const application of u.applications) {
          await client.query(
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
            `,
            [
              userId,
              application.company,
              application.job_title,
              application.status,
              application.job_url,
              application.location,
              application.notes,
              application.applied_at,
            ],
          );
        }
      }

      console.log(`[seed] upserted user: ${userRow.email} (${userRow.role})`);
    }
    await client.query("COMMIT");

    console.log("\n[seed] Done. Login credentials:");
    for (const u of users) {
      console.log(`- ${u.role}: ${u.email} / ${u.password}`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
