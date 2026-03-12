import {
  createAppExpectNoDbCalls,
  createTestAppWithDb,
  makeTestRequest,
} from "./testUtils";

describe("Application routes", () => {
  test("GET /applications returns 401 when unauthenticated", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications",
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: "Missing or invalid Authorization header",
    });
  });

  test("GET /applications returns applications for authenticated user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("from applications");
      expect(sql.toLowerCase()).toContain("where user_id = $1");
      expect(params).toEqual(["user-123"]);

      return {
        rows: [
          {
            id: 2,
            company: "applications Inc",
            job_title: "Software Engineer",
            status: "applied",
            job_url: "https://applications-inc.com/jobs/2",
            location: "Dayton, OH",
            notes: "Applied via company website",
            applied_at: "2026-03-12T12:00:00.000Z",
            created_at: "2026-03-12T12:00:00.000Z",
            updated_at: "2026-03-12T12:00:00.000Z",
          },
          {
            id: 1,
            company: "Tech Corp",
            job_title: "Software Engineer",
            status: "saved",
            job_url: null,
            location: null,
            notes: null,
            applied_at: null,
            created_at: "2026-03-12T12:00:00.000Z",
            updated_at: "2026-03-12T12:00:00.000Z",
          },
        ],
        rowCount: 2,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      applications: [
        {
          id: 2,
          company: "applications Inc",
          job_title: "Software Engineer",
          status: "applied",
          job_url: "https://applications-inc.com/jobs/2",
          location: "Dayton, OH",
          notes: "Applied via company website",
          applied_at: "2026-03-12T12:00:00.000Z",
          created_at: "2026-03-12T12:00:00.000Z",
          updated_at: "2026-03-12T12:00:00.000Z",
        },
        {
          id: 1,
          company: "Tech Corp",
          job_title: "Software Engineer",
          status: "saved",
          job_url: null,
          location: null,
          notes: null,
          applied_at: null,
          created_at: "2026-03-12T12:00:00.000Z",
          updated_at: "2026-03-12T12:00:00.000Z",
        },
      ],
    });
  });

  test("POST /applications creates an application for authenticated user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("insert into applications");
      expect(params).toEqual([
        "user-123",
        "Tech Corp",
        "Software Engineer",
        "saved",
        null,
        null,
        null,
        "2026-03-12T12:00:00.000Z",
      ]);
      return {
        rows: [
          {
            id: 1,
            company: "Tech Corp",
            job_title: "Software Engineer",
            status: "saved",
            job_url: null,
            location: null,
            notes: null,
            applied_at: null,
            created_at: "2026-03-12T12:00:00.000Z",
            updated_at: "2026-03-12T12:00:00.000Z",
          },
        ],
      };
    });
    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/applications",
      auth: { sub: "user-123", role: "user" },
      body: {
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "saved",
        applied_at: "2026-03-12T12:00:00.000Z",
      },
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      application: {
        id: 1,
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "saved",
        job_url: null,
        location: null,
        notes: null,
        applied_at: null,
        created_at: "2026-03-12T12:00:00.000Z",
        updated_at: "2026-03-12T12:00:00.000Z",
      },
    });
  });

  test("POST /applications returns 401 when unauthenticated", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/applications",
      body: {
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "saved",
        applied_at: "2026-03-12T12:00:00.000Z",
      },
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: "Missing or invalid Authorization header",
    });
  });

  test("POST /applications returns 400 when company is missing", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/applications",
      auth: { sub: "user-123", role: "user" },
      body: {
        company: "",
        job_title: "Software Engineer",
        status: "saved",
      },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "company is required" });
  });

  test("POST /applications returns 400 when job_title is missing", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/applications",
      auth: { sub: "user-123", role: "user" },
      body: {
        company: "Tech Corp",
        job_title: "  ",
        status: "saved",
      },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "job_title is required" });
  });

  test("POST /applications returns 400 when invalid status", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/applications",
      auth: { sub: "user-123", role: "user" },
      body: {
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "unsupported_status",
      },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid status" });
  });
});
