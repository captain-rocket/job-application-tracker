import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

type JwtPayload = {
  sub: string;
  role: "user" | "admin";
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.JWT_SECRET;
  if (!secret)
    return res.status(500).json({ error: "JWT_SECRET not configured" });

  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json("Missing or invalid Authorization header");
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (!decoded?.sub || !decoded?.role) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expored token" });
  }
}
