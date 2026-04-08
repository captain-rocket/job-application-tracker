import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "test" | "production";

function getNodeEnv(): NodeEnv {
  const v = process.env.NODE_ENV?.trim();

  if (!v) return "development";
  if (v !== "development" && v !== "test" && v !== "production")
    throw new Error(
      "Environment variable NODE_ENV must be one of: development, test or production",
    );
  return v;
}

function getRequiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "")
    throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getOptionalEnv(name: string): string | undefined {
  const v = process.env[name];
  if (!v || v.trim() === "") return undefined;

  return v.trim();
}

function getNumberEnv(name: string, fallback?: number): number {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Missing required env var: ${name}`);
  }
  const parsed = Number(v);
  if (Number.isNaN(parsed))
    throw new Error(`Environment variable ${name} must be a valid number`);
  return parsed;
}

function getBooleanEnv(name: string, fallback = false): boolean {
  const v = process.env[name];

  if (!v || v.trim() === "") return fallback;

  const normalized = v.trim().toLowerCase();

  if (normalized === "true") return true;

  if (normalized === "false") return false;

  throw new Error(`Environment variable ${name} must be true or false`);
}

export function getAppEnv() {
  const nodeEnv = getNodeEnv();

  return {
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isTest: nodeEnv === "test",
    isProduction: nodeEnv === "production",
  };
}

function validateJwtSecret(jwtSecret: string, isProduction: boolean) {
  if (!isProduction) return;

  const normalized = jwtSecret.trim().toLowerCase();

  if (jwtSecret.length < 32)
    throw new Error("JWT_SECRET must be at least 32 characters in production");

  const blockSecrets = new Set([
    "dev-secret",
    "development-secret",
    "change-me",
    "changeme",
    "password",
    "<replace-with-32-character-secret>",
    "replace-with-32-character-secret",
    "replace-with-a-32-character-or-longer-secret",
    "secret",
    "test-secret",
  ]);
  if (blockSecrets.has(normalized))
    throw new Error("JWT_SECRET is not strong enough for production");
}

function validateDbPassword(dbPassword: string, isProduction: boolean) {
  if (!isProduction) return;

  const normalized = dbPassword.trim().toLowerCase();
  const blockedPasswords = new Set([
    "<replace-with-rds-password>",
    "replace-with-rds-password",
    "change-this-db-password",
    "changeme",
    "password",
  ]);

  if (blockedPasswords.has(normalized))
    throw new Error("DB_PASSWORD is not strong enough for production");
}

export function getDbEnv() {
  const { isProduction } = getAppEnv();
  const dbPassword = getRequiredEnv("DB_PASSWORD");

  const sslEnabled = getBooleanEnv("DB_SSL", isProduction);
  const sslRejectUnauthorized = getBooleanEnv(
    "DB_SSL_REJECT_UNAUTHORIZED",
    true,
  );

  validateDbPassword(dbPassword, isProduction);

  return {
    host: getRequiredEnv("DB_HOST"),
    port: getNumberEnv("DB_PORT", 5432),
    user: getRequiredEnv("DB_USER"),
    password: dbPassword,
    database: getRequiredEnv("DB_NAME"),
    sslEnabled,
    sslRejectUnauthorized,
  };
}

export function getAuthEnv() {
  const { isProduction } = getAppEnv();
  const jwtSecret = getRequiredEnv("JWT_SECRET");

  validateJwtSecret(jwtSecret, isProduction);

  return {
    jwtSecret: getRequiredEnv("JWT_SECRET"),
  };
}

export function getServerEnv() {
  const app = getAppEnv();
  const port = getNumberEnv("PORT", 4000);
  const db = getDbEnv();
  const auth = getAuthEnv();

  if (app.isProduction && port <= 0)
    throw new Error("PORT must be a positive number");

  return {
    nodeEnv: app.nodeEnv,
    isDevelopment: app.isDevelopment,
    isTest: app.isTest,
    isProduction: app.isProduction,
    port,
    db,
    auth,
  };
}

export function getDbSslConfig() {
  const db = getDbEnv();

  if (!db.sslEnabled) return false;

  return { rejectUnauthorized: db.sslRejectUnauthorized };
}

export function getRedactedStartupConfig() {
  const { nodeEnv, port, db } = getServerEnv();

  return {
    nodeEnv,
    port,
    db: {
      host: db.host,
      port: db.port,
      user: db.user,
      database: db.database,
      sslEnabled: db.sslEnabled,
      sslRejectUnauthorized: db.sslRejectUnauthorized,
    },
  };
}
