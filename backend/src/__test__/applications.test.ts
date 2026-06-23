import {
  createAppExpectNoDbCalls,
  createTestAppWithDb,
  makeTestRequest,
} from "./testUtils";

describe("Application routes", () => {
  const originalPublicDemoUserEmail = process.env.PUBLIC_DEMO_USER_EMAIL;

  beforeEach(() => {
    delete process.env.PUBLIC_DEMO_USER_EMAIL;
  });

  afterEach(() => {
    if (originalPublicDemoUserEmail === undefined) {
      delete process.env.PUBLIC_DEMO_USER_EMAIL;
    } else {
      process.env.PUBLIC_DEMO_USER_EMAIL = originalPublicDemoUserEmail;
    }
  });

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

  test("GET /applications returns paginated applications for authenticated user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("from applications");
      expect(sql.toLowerCase()).toContain("where user_id = $1");
      expect(sql).toContain("COUNT(*) OVER()::int AS total_count");
      expect(sql).toContain("LIMIT $2 OFFSET $3");
      expect(params).toEqual(["user-123", 50, 0]);

      return {
        rows: [
          {
            id: 2,
            company: "Applications Inc",
            job_title: "Software Engineer",
            status: "applied",
            job_url: "https://applications-inc.com/jobs/2",
            location: "Dayton, OH",
            notes: "Applied via company website",
            applied_at: "2026-03-12T12:00:00.000Z",
            created_at: "2026-03-12T12:00:00.000Z",
            updated_at: "2026-03-12T12:00:00.000Z",
            total_count: 2,
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
            total_count: 2,
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
          company: "Applications Inc",
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
      pagination: {
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      },
    });
  });

  test("GET /applications applies status filter and pagination query params", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("where user_id = $1 and status = $2");
      expect(sql).toContain("LIMIT $3 OFFSET $4");
      expect(params).toEqual(["user-123", "applied", 5, 5]);

      return {
        rows: [
          {
            id: 7,
            company: "Filter Corp",
            job_title: "Backend Engineer",
            status: "applied",
            job_url: null,
            location: null,
            notes: null,
            applied_at: "2026-03-15T12:00:00.000Z",
            created_at: "2026-03-15T12:00:00.000Z",
            updated_at: "2026-03-15T12:00:00.000Z",
            total_count: 11,
          },
        ],
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications?status=applied&page=2&limit=5",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      applications: [
        {
          id: 7,
          company: "Filter Corp",
          job_title: "Backend Engineer",
          status: "applied",
          job_url: null,
          location: null,
          notes: null,
          applied_at: "2026-03-15T12:00:00.000Z",
          created_at: "2026-03-15T12:00:00.000Z",
          updated_at: "2026-03-15T12:00:00.000Z",
        },
      ],
      pagination: {
        page: 2,
        limit: 5,
        total: 11,
        totalPages: 3,
      },
    });
  });

  test("GET /applications keeps pagination totals when requested page has no rows", async () => {
    let callCount = 0;

    const app = createTestAppWithDb(async (sql, params) => {
      callCount += 1;
      if (callCount === 1) {
        expect(sql).toContain("COUNT(*) OVER()::int AS total_count");
        expect(sql).toContain("LIMIT $2 OFFSET $3");
        expect(params).toEqual(["user-123", 5, 15]);
        return {
          rows: [],
          rowCount: 0,
        };
      }

      expect(sql).toContain("SELECT COUNT(*)::int AS total_count");
      expect(sql.toLowerCase()).toContain("where user_id = $1");
      expect(params).toEqual(["user-123"]);

      return {
        rows: [{ total_count: 11 }],
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications?page=4&limit=5",
      auth: { sub: "user-123", role: "user" },
    });

    expect(callCount).toBe(2);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      applications: [],
      pagination: {
        page: 4,
        limit: 5,
        total: 11,
        totalPages: 3,
      },
    });
  });

  test("GET /applications returns 400 for invalid pagination query", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications?page=0",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "page must be at least 1" });
  });

  test("GET /applications applies status filter with default pagination", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("where user_id = $1 and status = $2");
      expect(sql).toContain("LIMIT $3 OFFSET $4");
      expect(params).toEqual(["user-123", "interviewing", 50, 0]);

      return {
        rows: [
          {
            id: 3,
            company: "Default Paging Corp",
            job_title: "Platform Engineer",
            status: "interviewing",
            job_url: null,
            location: null,
            notes: null,
            applied_at: null,
            created_at: "2026-03-16T12:00:00.000Z",
            updated_at: "2026-03-16T12:00:00.000Z",
            total_count: 1,
          },
        ],
        rowCount: 1,
      };
    });
    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications?status=interviewing",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      applications: [
        {
          id: 3,
          company: "Default Paging Corp",
          job_title: "Platform Engineer",
          status: "interviewing",
          job_url: null,
          location: null,
          notes: null,
          applied_at: null,
          created_at: "2026-03-16T12:00:00.000Z",
          updated_at: "2026-03-16T12:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      },
    });
  });

  test("GET /applications returns 400 for invalid status query", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");
    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications?status=unsupported_status",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid status" });
  });

  test("GET /applications returns 400 for limit above max", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications?limit=51",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "limit must be at most 50",
    });
  });

  test("GET /applications returns 400 for non-integer page", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications?page=1.5",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "page must be a whole number",
    });
  });

  test("GET /applications returns 400 for non-integer limit", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications?limit=abc",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "limit must be a whole number",
    });
  });

  test("GET /applications/:id returns 400 for invalid id", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications/not-a-number",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid application id" });
  });

  test("GET /applications/:id returns 404 when application does not exist for user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("where id = $1 and user_id = $2");
      expect(params).toEqual([1, "user-123"]);

      return {
        rows: [],
        rowCount: 0,
      };
    });
    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Application not found" });
  });

  test("GET /applications/:id returns application for authenticated user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("from applications");
      expect(sql.toLowerCase()).toContain("where id = $1 and user_id = $2");
      expect(params).toEqual([1, "user-123"]);

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
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(200);
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
            applied_at: "2026-03-12T12:00:00.000Z",
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
        applied_at: "2026-03-12T12:00:00.000Z",
        created_at: "2026-03-12T12:00:00.000Z",
        updated_at: "2026-03-12T12:00:00.000Z",
      },
    });
  });

  test("POST /applications creates a throwaway application for the demo user under the cap", async () => {
    process.env.PUBLIC_DEMO_USER_EMAIL = "demo@example.com";

    let queryCount = 0;
    const app = createTestAppWithDb(async (sql, params) => {
      queryCount += 1;
      const q = sql.toLowerCase().replace(/\s+/g, " ").trim();

      if (q.includes("from users u") && q.includes("left join applications")) {
        expect(q).toContain("a.is_demo_seed = false");
        expect(q).toContain("interval '10 minutes'");
        expect(params).toEqual(["demo-user", "demo@example.com"]);
        return {
          rows: [
            {
              id: "demo-user",
              total_created: 49,
              recent_created: 4,
            },
          ],
          rowCount: 1,
        };
      }

      if (q.includes("insert into applications")) {
        expect(params).toEqual([
          "demo-user",
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
              applied_at: "2026-03-12T12:00:00.000Z",
              is_demo_seed: false,
              created_at: "2026-03-12T12:00:00.000Z",
              updated_at: "2026-03-12T12:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected SQL in demo create under cap test: ${sql}`);
    });

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/applications",
      auth: { sub: "demo-user", role: "user" },
      body: {
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "saved",
        applied_at: "2026-03-12T12:00:00.000Z",
      },
    });

    expect(queryCount).toBe(2);
    expect(res.status).toBe(201);
    expect(res.body.application.is_demo_seed).toBe(false);
  });

  test("POST /applications blocks demo user when total demo-created cap is reached", async () => {
    process.env.PUBLIC_DEMO_USER_EMAIL = "demo@example.com";

    const app = createTestAppWithDb(async (sql, params) => {
      const q = sql.toLowerCase().replace(/\s+/g, " ").trim();

      if (q.includes("from users u") && q.includes("left join applications")) {
        expect(q).toContain("a.is_demo_seed = false");
        expect(params).toEqual(["demo-user", "demo@example.com"]);
        return {
          rows: [
            {
              id: "demo-user",
              total_created: 50,
              recent_created: 0,
            },
          ],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected SQL in demo total cap test: ${sql}`);
    });

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/applications",
      auth: { sub: "demo-user", role: "user" },
      body: {
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "saved",
      },
    });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: "Demo account create limit reached.",
    });
  });

  test("POST /applications blocks demo user when burst create cap is reached", async () => {
    process.env.PUBLIC_DEMO_USER_EMAIL = "demo@example.com";

    const app = createTestAppWithDb(async (sql, params) => {
      const q = sql.toLowerCase().replace(/\s+/g, " ").trim();

      if (q.includes("from users u") && q.includes("left join applications")) {
        expect(q).toContain("interval '10 minutes'");
        expect(q).toContain("a.is_demo_seed = false");
        expect(params).toEqual(["demo-user", "demo@example.com"]);
        return {
          rows: [
            {
              id: "demo-user",
              total_created: 10,
              recent_created: 5,
            },
          ],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected SQL in demo burst cap test: ${sql}`);
    });

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/applications",
      auth: { sub: "demo-user", role: "user" },
      body: {
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "saved",
      },
    });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: "Please wait before creating more demo records.",
    });
  });

  test("POST /applications does not block non-demo users when demo limits are configured", async () => {
    process.env.PUBLIC_DEMO_USER_EMAIL = "demo@example.com";

    let queryCount = 0;
    const app = createTestAppWithDb(async (sql, params) => {
      queryCount += 1;
      const q = sql.toLowerCase().replace(/\s+/g, " ").trim();

      if (q.includes("from users u") && q.includes("left join applications")) {
        expect(params).toEqual(["user-123", "demo@example.com"]);
        return {
          rows: [],
          rowCount: 0,
        };
      }

      if (q.includes("insert into applications")) {
        expect(params).toEqual([
          "user-123",
          "Tech Corp",
          "Software Engineer",
          "saved",
          null,
          null,
          null,
          null,
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
              is_demo_seed: false,
              created_at: "2026-03-12T12:00:00.000Z",
              updated_at: "2026-03-12T12:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected SQL in non-demo create limit test: ${sql}`);
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
      },
    });

    expect(queryCount).toBe(2);
    expect(res.status).toBe(201);
    expect(res.body.application).toMatchObject({
      id: 1,
      company: "Tech Corp",
      is_demo_seed: false,
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

  test("PATCH /applications/:id returns 401 when unauthenticated", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      body: {
        status: "interviewing",
      },
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: "Missing or invalid Authorization header",
    });
  });

  test("PATCH /applications/:id returns 400 for invalid id", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/not-a-number",
      auth: { sub: "user-123", role: "user" },
      body: {
        status: "interviewing",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid application id" });
  });

  test("PATCH /applications/:id returns 400 when no response body", async () => {
    const app = createAppExpectNoDbCalls("fields.noneProvided");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-1", role: "user" },
      body: null,
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "No valid fields provided for update" });
  });

  test("PATCH /applications/:id returns 400 when no fields provided", async () => {
    const app = createAppExpectNoDbCalls("fields.noneProvided");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-1", role: "user" },
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "No valid fields provided for update" });
  });

  test("PATCH /applications/:id returns 400 when company is empty", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
      body: { company: "   " },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "company cannot be empty",
    });
  });

  test("PATCH /applications/:id returns 400 when job_title is empty", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
      body: { job_title: "   " },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "job_title cannot be empty",
    });
  });

  test("PATCH /applications/:id returns 400 when only unknown fields are provided", async () => {
    const app = createAppExpectNoDbCalls("fields.noneProvided");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
      body: { unsupported_field: "value" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "No valid fields provided for update",
    });
  });

  test("PATCH /applications/:id returns 400 when invalid status", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
      body: {
        status: "unsupported_status",
      },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid status" });
  });

  test("PATCH /applications/:id returns 404 when application does not exist for user", async () => {
    let callCount = 0;
    const app = createTestAppWithDb(async (sql, params) => {
      callCount += 1;

      if (callCount === 1) {
        expect(sql.toLowerCase()).toContain("update applications");
        expect(sql.toLowerCase()).toContain("where id = $2 and user_id = $3");
        expect(sql.toLowerCase()).toContain("is_demo_seed = false");
        expect(params).toEqual(["interviewing", 1, "user-123"]);

        return {
          rows: [],
          rowCount: 0,
        };
      }

      expect(sql.toLowerCase()).toContain("select id, is_demo_seed");
      expect(sql.toLowerCase()).toContain("where id = $1 and user_id = $2");
      expect(params).toEqual([1, "user-123"]);

      return {
        rows: [],
        rowCount: 0,
      };
    });
    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
      body: {
        status: "interviewing",
      },
    });

    expect(callCount).toBe(2);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Application not found" });
  });

  test("PATCH /applications/:id returns 403 for protected demo seed records", async () => {
    let callCount = 0;
    const app = createTestAppWithDb(async (sql, params) => {
      callCount += 1;

      if (callCount === 1) {
        expect(sql.toLowerCase()).toContain("update applications");
        expect(sql.toLowerCase()).toContain("is_demo_seed = false");
        expect(params).toEqual(["interviewing", 1, "demo-user"]);
        return { rows: [], rowCount: 0 };
      }

      expect(sql.toLowerCase()).toContain("select id, is_demo_seed");
      expect(params).toEqual([1, "demo-user"]);
      return {
        rows: [{ id: 1, is_demo_seed: true }],
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "demo-user", role: "user" },
      body: {
        status: "interviewing",
      },
    });

    expect(callCount).toBe(2);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: "Protected demo seed applications cannot be edited",
    });
  });

  test("PATCH /applications/:id updates application for authenticated user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("update applications");
      expect(sql).toContain("status = $3");
      expect(sql).toContain("notes = $4");
      expect(sql).toContain("updated_at = NOW()");
      expect(sql.toLowerCase()).toContain("where id = $5 and user_id = $6");
      expect(params).toEqual([
        "Tech Corp",
        "Software Engineer",
        "interviewing",
        "Interview with Garrett",
        1,
        "user-123",
      ]);
      return {
        rows: [
          {
            id: 1,
            company: "Tech Corp",
            job_title: "Software Engineer",
            status: "interviewing",
            job_url: null,
            location: null,
            notes: "Interview with Garrett",
            applied_at: "2026-02-20T12:00:00.000Z",
            created_at: "2026-02-10T07:00:00.000Z",
            updated_at: "2026-03-12T07:00:00.000Z",
          },
        ],
        rowCount: 1,
      };
    });
    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
      body: {
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "interviewing",
        notes: "Interview with Garrett",
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      application: {
        id: 1,
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "interviewing",
        job_url: null,
        location: null,
        notes: "Interview with Garrett",
        applied_at: "2026-02-20T12:00:00.000Z",
        created_at: "2026-02-10T07:00:00.000Z",
        updated_at: "2026-03-12T07:00:00.000Z",
      },
    });
  });

  test("PATCH /applications/:id updates applied_at with a bound parameter", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("update applications");
      expect(sql).toContain("status = $1");
      expect(sql).toContain("applied_at = $2");
      expect(sql).toContain("updated_at = NOW()");
      expect(sql.toLowerCase()).toContain("where id = $3 and user_id = $4");
      expect(params).toEqual([
        "applied",
        "2026-03-12T12:00:00.000Z",
        1,
        "user-123",
      ]);

      return {
        rows: [
          {
            id: 1,
            company: "Tech Corp",
            job_title: "Software Engineer",
            status: "applied",
            job_url: null,
            location: null,
            notes: null,
            applied_at: "2026-03-12T12:00:00.000Z",
            created_at: "2026-02-10T07:00:00.000Z",
            updated_at: "2026-03-13T07:00:00.000Z",
          },
        ],
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
      body: {
        status: "applied",
        applied_at: "2026-03-12T12:00:00.000Z",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      application: {
        id: 1,
        company: "Tech Corp",
        job_title: "Software Engineer",
        status: "applied",
        job_url: null,
        location: null,
        notes: null,
        applied_at: "2026-03-12T12:00:00.000Z",
        created_at: "2026-02-10T07:00:00.000Z",
        updated_at: "2026-03-13T07:00:00.000Z",
      },
    });
  });

  test("PATCH /applications/:id updates demo-created throwaway records", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("update applications");
      expect(sql.toLowerCase()).toContain("is_demo_seed = false");
      expect(sql.toLowerCase()).toContain("where id = $2 and user_id = $3");
      expect(params).toEqual(["offer", 1, "demo-user"]);

      return {
        rows: [
          {
            id: 1,
            company: "Throwaway Corp",
            job_title: "Software Engineer",
            status: "offer",
            job_url: null,
            location: null,
            notes: null,
            applied_at: null,
            is_demo_seed: false,
            created_at: "2026-06-21T12:00:00.000Z",
            updated_at: "2026-06-22T12:00:00.000Z",
          },
        ],
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/applications/1",
      auth: { sub: "demo-user", role: "user" },
      body: {
        status: "offer",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.application).toMatchObject({
      id: 1,
      company: "Throwaway Corp",
      status: "offer",
      is_demo_seed: false,
    });
  });

  test("DELETE /applications/:id returns 401 when unauthenticated", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/applications/1",
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: "Missing or invalid Authorization header",
    });
  });

  test("DELETE /applications/:id returns 400 for invalid id", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/applications/not-a-number",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid application id" });
  });

  test("DELETE /applications/:id returns 404 when application does not exist for user", async () => {
    let callCount = 0;
    const app = createTestAppWithDb(async (sql, params) => {
      callCount += 1;

      if (callCount === 1) {
        expect(sql.toLowerCase()).toContain("delete from applications");
        expect(sql.toLowerCase()).toContain("where id = $1 and user_id = $2");
        expect(sql.toLowerCase()).toContain("is_demo_seed = false");
        expect(params).toEqual([1, "user-123"]);

        return {
          rows: [],
          rowCount: 0,
        };
      }

      expect(sql.toLowerCase()).toContain("select id, is_demo_seed");
      expect(sql.toLowerCase()).toContain("where id = $1 and user_id = $2");
      expect(params).toEqual([1, "user-123"]);

      return {
        rows: [],
        rowCount: 0,
      };
    });
    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
    });

    expect(callCount).toBe(2);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Application not found" });
  });

  test("DELETE /applications/:id returns 403 for protected demo seed records", async () => {
    let callCount = 0;
    const app = createTestAppWithDb(async (sql, params) => {
      callCount += 1;

      if (callCount === 1) {
        expect(sql.toLowerCase()).toContain("delete from applications");
        expect(sql.toLowerCase()).toContain("is_demo_seed = false");
        expect(params).toEqual([1, "demo-user"]);
        return { rows: [], rowCount: 0 };
      }

      expect(sql.toLowerCase()).toContain("select id, is_demo_seed");
      expect(params).toEqual([1, "demo-user"]);
      return {
        rows: [{ id: 1, is_demo_seed: true }],
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/applications/1",
      auth: { sub: "demo-user", role: "user" },
    });

    expect(callCount).toBe(2);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: "Protected demo seed applications cannot be deleted",
    });
  });

  test("DELETE /applications/:id deletes application for authenticated user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("delete from applications");
      expect(sql.toLowerCase()).toContain("where id = $1 and user_id = $2");
      expect(params).toEqual([1, "user-123"]);

      return {
        rows: [{ id: 1 }],
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/applications/1",
      auth: { sub: "user-123", role: "user" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Application deleted" });
  });

  test("DELETE /applications/:id deletes demo-created throwaway records", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("delete from applications");
      expect(sql.toLowerCase()).toContain("where id = $1 and user_id = $2");
      expect(sql.toLowerCase()).toContain("is_demo_seed = false");
      expect(params).toEqual([1, "demo-user"]);

      return {
        rows: [{ id: 1 }],
        rowCount: 1,
      };
    });

    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/applications/1",
      auth: { sub: "demo-user", role: "user" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Application deleted" });
  });
});
