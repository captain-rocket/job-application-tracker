import request from "supertest";
import { createApp } from "../app";

type Dblike = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: any[]; rowCount?: number }>;
};

describe("API routes", () => {
  test("GET /health returns status: true", async () => {
    const db: Dblike = {
      query: async () => ({ rows: [] }),
    };

    const app = createApp(db as any);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: true });
  });

  test("GET /task returns tasks array from db", async () => {
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
      query: async () => ({ rows: fakeRows }),
    };

    const app = createApp(db as any);

    const res = await request(app).get("/tasks");

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
        expect(params).toEqual(["New task"]);
        return { rows: [created] };
      },
    };

    const app = createApp(db as any);

    const res = await request(app).post("/tasks").send({ title: "New task" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ task: created });
  });
});
