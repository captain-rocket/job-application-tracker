import {
  createAppExpectNoDbCalls,
  createTestAppWithDb,
  makeTestRequest,
} from "./testUtils";

describe("Task routes", () => {
  test("GET /health returns status: true", async () => {
    const app = createTestAppWithDb(async () => ({ rows: [] }));

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/health",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: true });
  });

  test("GET /tasks returns tasks array from db (requires JWT)", async () => {
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

    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("from tasks");
      expect(params).toEqual(["user-1"]);
      return { rows: fakeRows };
    });

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/tasks",
      auth: { sub: "user-1", role: "user" },
    });

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

    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("insert into tasks");
      expect(params).toEqual(["user-1", "New task"]);
      return { rows: [created], rowCount: 1 };
    });

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/tasks",
      auth: { sub: "user-1", role: "user" },
      body: { title: "New task" },
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ task: created });
  });

  test("GET /tasks without JWT returns 401", async () => {
    const app = createTestAppWithDb(async () => ({ rows: [] }));

    const res = await makeTestRequest({
      app,
      method: "get",
      path: "/tasks",
    });

    expect(res.status).toBe(401);
  });

  test("POST /tasks returns 400 when title is missing", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/tasks",
      auth: { sub: "user-1", role: "user" },
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "title is required" });
  });

  test("POST /tasks returns 400 when title is blank", async () => {
    const app = createAppExpectNoDbCalls("input.invalid");

    const res = await makeTestRequest({
      app,
      method: "post",
      path: "/tasks",
      auth: { sub: "user-1", role: "user" },
      body: { title: "  " },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "title is required" });
  });

  test("PATCH /tasks/:id returns 400 for invalid id", async () => {
    const app = createAppExpectNoDbCalls("id.invalid");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/tasks/not-a-number",
      auth: { sub: "user-1", role: "user" },
      body: { completed: true },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid id" });
  });

  test("PATCH /tasks/:id returns 400 when no fields provided", async () => {
    const app = createAppExpectNoDbCalls("fields.noneProvided");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/tasks/1",
      auth: { sub: "user-1", role: "user" },
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Provide title and/or completed" });
  });

  test("PATCH /tasks/:id returns 400 when title is empty string", async () => {
    const app = createAppExpectNoDbCalls("title.empty");

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/tasks/1",
      auth: { sub: "user-1", role: "user" },
      body: { title: "  " },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "title cannot be empty" });
  });

  test("PATCH /tasks/:id returns 404 when task not found for user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("update tasks");
      expect(params?.[0]).toBe(123);
      expect(params?.[1]).toBe("user-1");
      return { rows: [], rowCount: 0 };
    });

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/tasks/123",
      auth: { sub: "user-1", role: "user" },
      body: { completed: true },
    });

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

    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("update tasks");
      expect(params?.[0]).toBe(1);
      expect(params?.[1]).toBe("user-1");
      expect(params?.[2]).toBe("updated");
      expect(params?.[3]).toBe(true);
      return { rows: [updated], rowCount: 1 };
    });

    const res = await makeTestRequest({
      app,
      method: "patch",
      path: "/tasks/1",
      auth: { sub: "user-1", role: "user" },
      body: { title: "updated", completed: true },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ task: updated });
  });

  test("DELETE /tasks/:id returns 400 for invalid id", async () => {
    const app = createAppExpectNoDbCalls("id.invalid");

    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/tasks/denied",
      auth: { sub: "user-1", role: "user" },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid id" });
  });

  test("DELETE /tasks/:id returns 404 when task not found for user", async () => {
    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("delete from tasks");
      expect(params).toEqual([99, "user-1"]);
      return { rows: [], rowCount: 0 };
    });

    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/tasks/99",
      auth: { sub: "user-1", role: "user" },
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
  });

  test("DELETE /tasks/:id deletes task when found", async () => {
    const deleted = {
      id: 2,
      title: "B",
      completed: false,
      created_at: "2026-01-02T00:00:00Z",
    };

    const app = createTestAppWithDb(async (sql, params) => {
      expect(sql.toLowerCase()).toContain("delete from tasks");
      expect(params).toEqual([2, "user-1"]);
      return { rows: [deleted], rowCount: 1 };
    });

    const res = await makeTestRequest({
      app,
      method: "delete",
      path: "/tasks/2",
      auth: { sub: "user-1", role: "user" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted });
  });
});
