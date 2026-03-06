import { createApp } from "../app";
import jwt from "jsonwebtoken";
import request from "supertest";

export type Dblike = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: any[]; rowCount?: number }>;
};

type HttpMethod = "get" | "post" | "patch" | "delete";

const messages = {
  input: {
    invalid: "for invalid input",
  },
  fields: {
    noneProvided: "when no fields provided",
  },
  title: {
    empty: "for empty title",
  },
  id: {
    invalid: "for invalid id",
  },
} as const;

type MessageKey = {
  [K in keyof typeof messages]: `${K}.${Extract<keyof (typeof messages)[K], string>}`;
}[keyof typeof messages];

export function createTestAppWithDb(queryImpl: Dblike["query"]) {
  const db: Dblike = { query: queryImpl };
  return createApp(db as any);
}

export function createAppExpectNoDbCalls(message: MessageKey) {
  const db: Dblike = {
    query: async (_sql) => {
      const [msgType, msgStr] = message.split(".") as [
        keyof typeof messages,
        keyof (typeof messages)[keyof typeof messages],
      ];
      const msg = messages[msgType]?.[msgStr] ?? "unexpectedly";

      throw new Error(`db.query should not be called ${msg}`);
    },
  };
  return createApp(db as any);
}

export function makeAuthHeader(payload: {
  sub: string;
  role?: "user" | "admin";
}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set for test");
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

export async function makeTestRequest(options: {
  app: ReturnType<typeof createApp>;
  method: HttpMethod;
  path: string;
  auth?: { sub: string; role?: "user" | "admin" };
  body?: any;
}) {
  const { app, method, path, auth, body } = options;

  const agent = request(app);

  const METHODS: Record<HttpMethod, (path: string) => request.Test> = {
    get: (path) => agent.get(path),
    post: (path) => agent.post(path),
    patch: (path) => agent.patch(path),
    delete: (path) => agent.delete(path),
  };

  let req = METHODS[method](path);

  if (auth) {
    req = req.set(makeAuthHeader(auth));
  }
  if (body !== undefined) {
    req = req.send(body);
  }

  const res = await req;
  return res;
}
