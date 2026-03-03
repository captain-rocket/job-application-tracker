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

  test("POST /tasks returns 400 when title is missing", async () => {
    const db: Dblike = {
      query: async () => {
        throw new Error("db.query should not be called for invalid input");
      },
    };
    const app = createApp(db as any);

    const res = await request(app)
      .post("/tasks")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "title is required" });
  });

  test("POST /tasks returns 400 when title is blank", async () => {
    const db: Dblike = {
      query: async () => {
        throw new Error("db.query should not be called for invalid input");
      },
    };

    const app = createApp(db as any);
    const res = await request(app)
      .post("/tasks")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }))
      .send({ title: "  " });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "title is required" });
  });

  test("PATCH /tasks/id: returns 400 for invalid id", async () => {
    const db: Dblike = {
      query: async () => {
        throw new Error("db.query should not be called for invalid id");
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .patch("/tasks/not-a-number")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }))
      .send({ completed: true });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid id" });
  });

  test("PATCH /tasks/:id returns 400 when no fields provided", async () => {
    const db: Dblike = {
      query: async () => {
        throw new Error(
          "db.query should not be called when no fields provided",
        );
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .patch("/tasks/1")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Provide title and/or completed" });
  });

  test("PATCH /tasks/:id returns 400 when title is empty string", async () => {
    const db: Dblike = {
      query: async () => {
        throw new Error("db.query should not be called for empty title");
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .patch("/tasks/1")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }))
      .send({ title: "  " });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "title cannot be empty" });
  });

  test("PATCH /tasks/:id returns 404 when task not found for user", async () => {
    const db: Dblike = {
      query: async (sql, params) => {
        expect(sql.toLowerCase()).toContain("update tasks");

        expect(params?.[0]).toBe(123);
        expect(params?.[1]).toBe("user-1");
        return { rows: [], rowCount: 0 };
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .patch("/tasks/123")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }))
      .send({ completed: true });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
  });

  test("PATCH /tasks/:id updates task when found", async () => {
    const updated = {
      id: 1,
      title: "updated",
      completed: true,
      created_at: "2026-01-01T00:00:00Z",
    };

    const db: Dblike = {
      query: async (sql, params) => {
        expect(sql.toLowerCase()).toContain("update tasks");
        expect(params?.[0]).toBe(1);
        expect(params?.[1]).toBe("user-1");
        expect(params?.[2]).toBe("updated");
        expect(params?.[3]).toBe(true);

        return { rows: [updated], rowCount: 1 };
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .patch("/tasks/1")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }))
      .send({ title: "updated", completed: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ task: updated });
  });

  test("DELETE /tasks/:id returns 400 for invalid id", async () => {
    const db: Dblike = {
      query: async () => {
        throw new Error("db.query should not be called for invalid id");
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .delete("/tasks/denied")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid id" });
  });

  test("DELETE /tasks/:id returns 404 when task not found for user", async () => {
    const db: Dblike = {
      query: async (sql, params) => {
        expect(sql.toLowerCase()).toContain("delete from tasks");
        expect(params).toEqual([99, "user-1"]);
        return { rows: [], rowCount: 0 };
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .delete("/tasks/99")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
  });

  test("DELETE  /tasks/:id deletes task when found", async () => {
    const deleted = {
      id: 2,
      title: "B",
      completed: false,
      created_at: "2026-01-02T00:00:00Z",
    };

    const db: Dblike = {
      query: async (sql, params) => {
        expect(sql.toLowerCase()).toContain("delete from tasks");
        expect(params).toEqual([2, "user-1"]);
        return { rows: [deleted], rowCount: 1 };
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .delete("/tasks/2")
      .set(makeAuthHeader({ sub: "user-1", role: "user" }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted });
  });
});

describe("Auth routes", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  test("POST /auth/register success", async () => {
    const db: Dblike = {
      query: async (sql, params) => {
        if (sql.toLowerCase().includes("select id from users")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.toLowerCase().includes("insert into users")) {
          return {
            rows: [
              {
                id: "user-1",
                email: "me@example.com",
                role: "user",
                created_at: new Date().toISOString(),
              },
            ],
          };
        }
        throw new Error("Unexpected query");
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "me@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("me@example.com");
    expect(res.body.token).toBeDefined();
  });

  test("POST /auth/login wrong password", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("correctpassword", 10);

    const db: Dblike = {
      query: async () => ({
        rows: [
          {
            id: "user-1",
            email: "me@example.com",
            password_hash: hash,
            role: "user",
          },
        ],
        rowCount: 1,
      }),
    };

    const app = createApp(db as any);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "me@example.com", password: "wrongpassord" });

    expect(res.status).toBe(401);
  });

  test("GET /auth/me requires token", async () => {
    const db: Dblike = { query: async () => ({ rows: [] }) };
    const app = createApp(db as any);

    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
  });
});
