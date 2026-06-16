import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createAppExpectNoDbCalls,
  createTestAppWithDb,
  makeTestRequest,
} from "./testUtils";
import { resetAuthRateLimitForTests } from "../middleware/authRateLimit";
import request from "supertest";

describe("Auth routes", () => {
  const originalPublicRegistrationEnabled =
    process.env.PUBLIC_REGISTRATION_ENABLED;

  beforeEach(() => {
    delete process.env.PUBLIC_REGISTRATION_ENABLED;
    resetAuthRateLimitForTests();
  });

  afterEach(async () => {
    resetAuthRateLimitForTests();
    if (originalPublicRegistrationEnabled === undefined) {
      delete process.env.PUBLIC_REGISTRATION_ENABLED;
    } else {
      process.env.PUBLIC_REGISTRATION_ENABLED =
        originalPublicRegistrationEnabled;
    }
  });

  test("POST /auth/register creates a user and returns token", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
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
    });

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/register",
      body: { email: "me@example.com", password: "password123" },
    });

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
    const app = createTestAppWithDb(async (sql) => {
      const q = sql.toLowerCase().replace(/\s+/g, " ").trim();
      if (q.includes("from users") && q.includes("where email")) {
        return { rows: [{ id: "existing" }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL in duplicate test: ${sql}`);
    });

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/register",
      body: { email: "me@example.com", password: "password123" },
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "email already in use" });
  });

  test("POST /auth/register returns 403 when public registration is disabled", async () => {
    process.env.PUBLIC_REGISTRATION_ENABLED = "false";

    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/register",
      body: { email: "me@example.com", password: "password123" },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Registration is disabled" });
  });

  test("POST /auth/login returns 429 after too many auth attempts", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = await makeTestRequest({
        app,
        method: "post",
        path: "/auth/login",
        body: { email: "limit@example.com" },
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "password is required" });
    }

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/login",
      body: { email: "limit@example.com" },
    });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: "Too many auth attempts. Please try again later.",
    });
  });

  test("POST /auth/login returns token for valid credentials", async () => {
    const hash = await bcrypt.hash("password123", 10);

    const app = createTestAppWithDb(async (sql, params) => {
      const q = sql.toLowerCase();

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
    });

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/login",
      body: { email: "me@example.com", password: "password123" },
    });

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

    const app = createTestAppWithDb(async () => ({
      rows: [
        {
          id: "user-1",
          email: "me@example.com",
          password_hash: hash,
          role: "user",
        },
      ],
      rowCount: 1,
    }));

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/login",
      body: { email: "me@example.com", password: "wrong" },
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid credentials" });
  });

  test("GET /auth/me returns user for valid token", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      const q = sql.toLowerCase();
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
    });

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/auth/me",
      auth: { sub: "user-1", role: "user" },
    });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("user-1");
    expect(res.body.user.email).toBe("me@example.com");
  });

  test("GET /auth/me returns 404 when user does not exist", async () => {
    const app = createTestAppWithDb(async () => ({
      rows: [],
      rowCount: 0,
    }));

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/auth/me",
      auth: { sub: "missing-user", role: "user" },
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "user not found",
    });
  });

  test("GET /auth/me returns 401 for unsupported token role", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not set for test");
    const token = jwt.sign({ sub: "user-1", role: "superadmin" }, secret, {
      expiresIn: "5m",
    });

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid token payload" });
  });

  test("GET /auth/me returns 401 without token", async () => {
    const app = createTestAppWithDb(async () => ({ rows: [], rowCount: 0 }));

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/auth/me",
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: "Missing or invalid Authorization header",
    });
  });

  test("POST /auth/register returns 400 when email is missing", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/register",
      body: { password: "password123" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "email is required",
    });
  });

  test("POST /auth/register returns 400 when email is invalid", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/register",
      body: { email: "not-an-email", password: "password123" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "email must be a valid email address",
    });
  });

  test("POST /auth/register returns 400 when password is missing", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/register",
      body: { email: "me@example.com" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "password is required",
    });
  });

  test("POST /auth/register returns 400 when password is too short", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/register",
      body: { email: "me@example.com", password: "short" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "password must be at least 8 characters",
    });
  });

  test("POST /auth/login returns 400 when email is missing", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/login",
      body: { password: "password123" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "email is required",
    });
  });

  test("POST /auth/login returns 400 for malformed JSON", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email: "me@example.com"}');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Malformed JSON body" });
  });

  test("POST /auth/login returns 413 when JSON body is too large", async () => {
    const app = createAppExpectNoDbCalls("id.invalid");

    const res = await request(app)
      .post("/auth/login")
      .send({
        email: "me@example.com",
        password: "x".repeat(20_000),
      });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Request body too large" });
  });

  test("POST /auth/login returns 400 when password is missing", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/auth/login",
      body: { email: "me@example.com" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "password is required",
    });
  });
});
