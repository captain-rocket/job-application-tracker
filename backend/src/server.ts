import { getServerEnv } from "./config/env";
import { Pool } from "pg";
import { createApp } from "./app";

const { db, port } = getServerEnv();

const pool = new Pool({
  database: db.database,
  host: db.host,
  password: db.password,
  port: db.port,
  user: db.user,
});

pool.on("error", (err: Error) => {
  console.error("Unexpected DB error", err);
});

const app = createApp(pool);


app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
