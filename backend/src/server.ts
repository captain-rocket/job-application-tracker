import "dotenv/config";
import { Pool } from "pg";
import { createApp } from "./app";

const PORT = Number(process.env.PORT ?? 4000);

const db = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.on("error", (err: Error) => {
  console.error("Unexpected DB error", err);
});

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
