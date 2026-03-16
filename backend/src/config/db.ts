import { Pool, PoolConfig } from "pg";
import { getDbEnv, getDbSslConfig } from "./env";

export function getPoolConfig(): PoolConfig {
  const db = getDbEnv();

  return {
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
