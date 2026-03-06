import { createTestAppWithDb, makeTestRequest } from "./testUtils";

describe("Admin routes", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  test("Get /admin/users returns 403 for non-admin", async () => {
    const app = createTestAppWithDb(async () => ({ rows: [] }));

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/admin/users",
      auth: { sub: "user-1", role: "user" },
    });

    expect(res.status).toBe(403);
  });

  test("GET /admin/users returns users for admin", async () => {
    const app = createTestAppWithDb(async () => ({
      rows: [
        { id: "1", email: "a@test.com", role: "user" },
        { id: "2", email: "b@test.com", role: "admin" },
      ],
    }));

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/admin/users",
      auth: { sub: "admin-1", role: "admin" },
    });

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(2);
  });

  test("GET /admin/users returns 401 without token", async () => {
    const app = createTestAppWithDb(async () => ({ rows: [] }));

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/admin/users",
    });

    expect(res.status).toBe(401);
  });
});
