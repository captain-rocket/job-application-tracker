import { NextFunction, Request, Response } from "express";

export function requireRole(...allowed: Array<"user" | "admin">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
