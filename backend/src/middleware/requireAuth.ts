import { getAuthEnv } from "../config/env";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

type JwtPayload = {
  sub: string;
  role: "user" | "admin";
};

function isJwtPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as { sub?: unknown; role?: unknown };

  return (
    typeof payload.sub === "string" &&
    (payload.role === "user" || payload.role === "admin")
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  let jwtSecret: string;
  try {
    jwtSecret = getAuthEnv().jwtSecret;
  } catch (error) {
    return next(error);
  }

  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (!isJwtPayload(decoded)) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
