import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../app";

type Dblike = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: any[]; rowCount?: number }>;
};

describe("Admin routes", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  test("Get /admin/users returns 403 for non-admin", async () => {
    const db: Dblike = { query: async () => ({ rows: [] }) };

    const app = createApp(db as any);

    const token = jwt.sign(
      { sub: "user-1", role: "user" },
      process.env.JWT_SECRET!,
    );

    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test("GET /admin/users returns users for admin", async () => {
    const db: Dblike = {
      query: async () => ({
        rows: [
          { id: "1", email: "a@test.com", role: "user" },
          { id: "2", email: "b@test.com", role: "admin" },
        ],
      }),
    };

    const app = createApp(db as any);

    const token = jwt.sign(
      { sub: "admin-1", role: "admin" },
      process.env.JWT_SECRET!,
    );

    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(2);
  });

  test("GET /admin/users returns 401 without token", async () => {
    const db: Dblike = { query: async () => ({ rows: [] }) };

    const app = createApp(db as any);

    const res = await request(app).get("/admin/users");

    expect(res.status).toBe(401);
  });
});
