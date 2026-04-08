import { getServerEnv, getRedactedStartupConfig } from "./config/env";
import { createApp } from "./app";
import { createDbPool, verifyDbConnection } from "./config/db";

async function startServer() {
  const { port, nodeEnv } = getServerEnv();

  const pool = createDbPool();

  pool.on("error", (err: Error) => {
    console.error("Unexpected DB error", err);
  });

  await verifyDbConnection(pool);

  const app = createApp(pool);

  app.listen(port, () => {
    console.log("API startup config", getRedactedStartupConfig());
    console.log(`API listening on port ${port} (${nodeEnv})`);
  });
}

void startServer().catch((err: Error) => {
  console.error("Failed to start API", err);
  process.exit(1);
});
