import type { Pool } from "pg";
import { getPublicAccessEnv } from "../config/env";

type DemoApplicationSeed = {
  company: string;
  job_title: string;
  status: "saved" | "applied" | "interviewing" | "offer" | "rejected";
  job_url: string | null;
  location: string | null;
  notes: string | null;
  applied_at: string | null;
};

type PublicDemoUser = {
  id: string;
  email: string;
  role: "user";
};

type AuthenticatedUser = {
  id: string;
  email: string;
  role: "user" | "admin";
};

type PreparePublicDemoAccountResult =
  | { status: "not_configured" }
  | { status: "not_found" }
  | { status: "ready"; user: PublicDemoUser };

const DEMO_SEED_APPLICATIONS: DemoApplicationSeed[] = [
  {
    company: "Northstar Analytics",
    job_title: "Frontend Engineer",
    status: "saved",
    job_url: "https://careers.northstar-analytics.example/frontend-engineer",
    location: "Remote",
    notes: "Fictional seeded demo record for recruiter walkthroughs.",
    applied_at: null,
  },
  {
    company: "Harbor Cloud Systems",
    job_title: "Full Stack Developer",
    status: "applied",
    job_url: "https://jobs.harbor-cloud.example/full-stack-developer",
    location: "Columbus, OH",
    notes: "Fictional seeded demo record showing an applied role.",
    applied_at: "2026-04-10T14:30:00.000Z",
  },
  {
    company: "Lumen Health Tech",
    job_title: "Software Engineer",
    status: "interviewing",
    job_url: "https://careers.lumen-health.example/software-engineer",
    location: "Cincinnati, OH",
    notes: "Fictional seeded demo record showing interview progress.",
    applied_at: "2026-04-02T09:00:00.000Z",
  },
];

async function findPublicDemoUser(
  db: Pool,
  demoUserEmail: string,
): Promise<PublicDemoUser | null> {
  const result = await db.query(
    `
    SELECT id, email, role
    FROM users
    WHERE LOWER(email) = $1 AND role = 'user'
    `,
    [demoUserEmail],
  );

  if (!result.rowCount) return null;

  return result.rows[0] as PublicDemoUser;
}

async function cleanupExpiredDemoApplications(db: Pool, userId: string) {
  await db.query(
    `
    DELETE FROM applications
    WHERE user_id = $1
      AND is_demo_seed = false
      AND created_at < NOW() - INTERVAL '24 hours'
    `,
    [userId],
  );
}

async function resetProtectedDemoSeedApplications(db: Pool, userId: string) {
  const values: unknown[] = [userId];
  const placeholders = DEMO_SEED_APPLICATIONS.map((application, index) => {
    const base = index * 7 + 2;

    values.push(
      application.company,
      application.job_title,
      application.status,
      application.job_url,
      application.location,
      application.notes,
      application.applied_at,
    );

    return [
      "($1",
      `$${base}`,
      `$${base + 1}`,
      `$${base + 2}`,
      `$${base + 3}`,
      `$${base + 4}`,
      `$${base + 5}`,
      `$${base + 6}`,
      "true)",
    ].join(", ");
  }).join(",\n");

  await db.query(
    `
    WITH removed_demo_seed_applications AS (
      DELETE FROM applications
      WHERE user_id = $1 AND is_demo_seed = true
      RETURNING id
    )
    INSERT INTO applications (
      user_id,
      company,
      job_title,
      status,
      job_url,
      location,
      notes,
      applied_at,
      is_demo_seed
    )
    VALUES ${placeholders}
    `,
    values,
  );
}

async function preparePublicDemoData(db: Pool, userId: string) {
  await cleanupExpiredDemoApplications(db, userId);
  await resetProtectedDemoSeedApplications(db, userId);
}

export async function prepareAuthenticatedPublicDemoUser(
  db: Pool,
  user: AuthenticatedUser,
): Promise<boolean> {
  const { publicDemoUserEmail } = getPublicAccessEnv();

  if (!publicDemoUserEmail) return false;
  if (user.role !== "user") return false;
  if (user.email.toLowerCase() !== publicDemoUserEmail) return false;

  await preparePublicDemoData(db, user.id);
  return true;
}

export async function preparePublicDemoAccount(
  db: Pool,
): Promise<PreparePublicDemoAccountResult> {
  const { publicDemoUserEmail } = getPublicAccessEnv();

  if (!publicDemoUserEmail) return { status: "not_configured" };

  const user = await findPublicDemoUser(db, publicDemoUserEmail);
  if (!user) return { status: "not_found" };

  await preparePublicDemoData(db, user.id);

  return { status: "ready", user };
}
