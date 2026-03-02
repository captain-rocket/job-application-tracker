import { createApp } from "../app";
import jwt from "jsonwebtoken";
import request from "supertest";

type Dblike = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: any[]; rowCount?: number }>;
};

function makeAuthHeader(payload: { sub: string; role?: "user" | "admin" }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set fro test");
  }

  const token = jwt.sign(
    {
      sub: payload.sub,
      role: payload.role ?? "user",
    },
    secret,
    { expiresIn: "5m" },
  );

  return { Authorization: `Bearer ${token}` };
}

describe("API routes", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  test("GET /health returns status: true", async () => {
    const db: Dblike = {
      query: async () => ({ rows: [] }),
    };

    const app = createApp(db as any);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: true });
  });

  test("GET /task returns tasks array from db (requires JWT)", async () => {
    const fakeRows = [
      {
        id: 1,
        title: "A",
        completed: false,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: 2,
        title: "B",
        completed: true,
        created_at: "2020-01-02T00:00:00Z",
      },
    ];

    const db: Dblike = {
      query: async (sql, params) => {
        expect(sql.toLowerCase()).toContain("from tasks");
        expect(params).toEqual(["user-1"]);
        return { rows: fakeRows };
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .get("/tasks")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tasks: fakeRows });
  });

  test("POST /tasks creates a task and returns it", async () => {
    const created = {
      id: 3,
      title: "New task",
      completed: false,
      created_at: "2026-01-03T00:00:00Z",
    };

    const db: Dblike = {
      query: async (sql, params) => {
        expect(sql.toLowerCase()).toContain("insert into tasks");
        expect(params).toEqual(["user-1", "New task"]);
        return { rows: [created], rowCount: 1 };
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .post("/tasks")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }))
      .send({ title: "New task" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ task: created });
  });

  test("GET /tasks with out JWT returns 401", async () => {
    const db: Dblike = { query: async () => ({ rows: [] }) };
    const app = createApp(db as any);

    const res = await request(app).get("/tasks");

    expect(res.status).toBe(401);
  });
});
