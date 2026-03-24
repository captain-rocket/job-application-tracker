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
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("update applications");
      expect(sql.toLowerCase()).toContain("where id = $2 and user_id = $3");
      expect(params).toEqual(["interviewing", 1, "user-123"]);

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

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Application not found" });
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
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("delete from applications");
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

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Application not found" });
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
});
