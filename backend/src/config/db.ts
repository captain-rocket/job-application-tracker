import { Pool, PoolConfig } from "pg";
import { getDbEnv, getDbSslConfig } from "./env";

export const DB_CONNECTION_TIMEOUT_MS = 5000;

export function getPoolConfig(): PoolConfig {
  const db = getDbEnv();

  return {
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
    database: db.database,
    host: db.host,
    password: db.password,
    port: db.port,
    user: db.user,
    ssl: getDbSslConfig(),
  };
}

export function createDbPool() {
  return new Pool(getPoolConfig());
}

export async function verifyDbConnection(
  db: Pick<Pool, "query">,
): Promise<void> {
  await db.query("SELECT 1");
}
