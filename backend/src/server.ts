import { getServerEnv, getRedactedStartupConfig } from "./config/env";
import { createApp } from "./app";
import { createDbPool } from "./config/db";

const { port, nodeEnv } = getServerEnv();

const pool = createDbPool();

pool.on("error", (err: Error) => {
  console.error("Unexpected DB error", err);
});

const app = createApp(pool);

app.listen(port, () => {
  console.log("API startup config", getRedactedStartupConfig());
  console.log(`API listening on port ${port} (${nodeEnv})`);
});
