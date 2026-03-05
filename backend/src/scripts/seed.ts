import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

/**
 * Seed script goals:
 * - Create (or update) a known admin user + normal user
 * - Insert some tasks for each user
 * - Be safe to re-run (idempotent-ish)
 *
 * How it works:
 * - Upsert users by email (so re-running doesn't create duplicates)
 * - Delete tasks for those users (so the seed set is consistent)
 * - Insert a small set of tasks
 */

type Env = {
  DB_HOST: string;
  DB_NAME: string;
  DB_PASSWORD: string;
  DB_PORT: string;
  DB_USER: string;
};

function requireEnv(name: keyof Env): string {
  const v = process.env[name];

  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const pool = new Pool({
    database: requireEnv("DB_NAME"),
    host: requireEnv("DB_HOST"),
    password: requireEnv("DB_PASSWORD"),
    port: Number.parseInt(requireEnv("DB_PORT"), 10),
    user: requireEnv("DB_USER"),
  });

  const users = [
    {
      email: "admin@example.com",
      password: "AdminPass123!",
      role: "admin" as const,
      tasks: ["Review user list", "Check failed jobs", "Audit task ownership"],
    },
    {
      email: "user@example.com",
      password: "UserPass123!",
      role: "user" as const,
      tasks: ["Apply to 3 roles", "Refactor tests", "Push updates to GitHub"],
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
