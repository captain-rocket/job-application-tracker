import { NextFunction, Request, Response } from "express";
import { formatZodError, isZodError } from "./validate";

type ApiErrorBody = {
  error: string;
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiErrorBody>,
  _next: NextFunction,
) {
  if (res.headersSent) return;

  if (isZodError(err)) {
    return res.status(400).json({
      error: formatZodError(err),
    });
  }

  console.error(err);

  res.status(500).json({ error: "Internal Server Error" });
}
