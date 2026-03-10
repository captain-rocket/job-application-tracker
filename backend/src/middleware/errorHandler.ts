import { NextFunction, Request, Response } from "express";

type ApiErrorBody = {
  error: string;
  details?: unknown;
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiErrorBody>,
  _next: NextFunction,
) {
  console.error(err);

  if (res.headersSent) return;

  res.status(500).json({ error: "Internal Server Error" });
}
