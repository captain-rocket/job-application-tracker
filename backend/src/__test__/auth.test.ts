import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../app";

type Dblike = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: any[]; rowCount?: number }>;
};

describe("Auth routes", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  test("POST /auth/register creates a user and returns token", async () => {
    const db: Dblike = {
      query: async (sql, params) => {
        const q = sql.toLowerCase();

        if (q.includes("select id from users where email")) {
          expect(params).toEqual(["me@example.com"]);
          return { rows: [], rowCount: 0 };
        }
        if (q.includes("insert into users")) {
          expect(params?.[0]).toBe("me@example.com");
          expect(typeof params?.[1]).toBe("string");
          expect((params?.[1] as string).length).toBeGreaterThan(20);

          return {
            rows: [
              {
                id: "user-1",
                email: "me@example.com",
                role: "user",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            rowCount: 1,
          };
        }
        throw new Error(`Unexpected SQL in register ${sql}`);
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "me@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: "user-1",
      email: "me@example.com",
      role: "user",
    });
    expect(typeof res.body.token).toBe("string");

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET!) as any;
    expect(decoded.sub).toBe("user-1");
    expect(decoded.role).toBe("user");
  });

  test("POST /auth/register returns 409 for duplicate email", async () => {
    const db: Dblike = {
      query: async (sql) => {
        const q = sql.toLowerCase().replace(/\s+/g, " ").trim();
        if (q.includes("from users") && q.includes("where email")) {
          return { rows: [{ id: "existing" }], rowCount: 1 };
        }
        throw new Error(`Unexpected SQL in duplicate test: ${sql}`);
      },
    };
    const app = createApp(db as any);

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "me@example.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "email already in use" });
  });

  test("POST /auth/login returns token for valid credentials", async () => {
    const hash = await bcrypt.hash("password123", 10);

    const db: Dblike = {
      query: async (sql, params) => {
        const q = sql.toLocaleLowerCase();

        if (q.includes("from users") && q.includes("where email")) {
          expect(params).toEqual(["me@example.com"]);
          return {
            rows: [
              {
                id: "user-1",
                email: "me@example.com",
                password_hash: hash,
                role: "user",
              },
            ],
            rowCount: 1,
          };
        }
        throw new Error(`Unexpected SQL in login test: ${sql}`);
      },
    };

    const app = createApp(db as any);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "me@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: "user-1",
      email: "me@example.com",
      role: "user",
    });
    expect(typeof res.body.token).toBe("string");
  });

  test("POST /auth/login returns 401 for wrong password", async () => {
    const hash = await bcrypt.hash("password123", 10);

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
      .send({ email: "me@example.com", password: "wrong" });

    expect(res.status).toBe(401);
  });

  test("GET /auth/me returns user for valid token", async () => {
    const db: Dblike = {
      query: async (sql, params) => {
        const q = sql.toLocaleLowerCase();
        if (
          q.includes("select id, email, role, created_at from users where id")
        ) {
          expect(params).toEqual(["user-1"]);
          return {
            rows: [
              {
                id: "user-1",
                email: "me@example.com",
                role: "user",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            rowCount: 1,
          };
        }
        throw new Error(`Unexpected SQL in /me test: ${sql}`);
      },
    };

    const app = createApp(db as any);

    const token = jwt.sign(
      { sub: "user-1", role: "user" },
      process.env.JWT_SECRET!,
      {
        expiresIn: "5m",
      },
    );

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("user-1");
    expect(res.body.user.email).toBe("me@example.com");
  });

  test("GET /auth/me returns 401 without token", async () => {
    const db: Dblike = { query: async () => ({ rows: [], rowCount: 0 }) };

    const app = createApp(db as any);

    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
  });
});
