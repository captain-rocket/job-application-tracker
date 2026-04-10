import { NextFunction, Request, Response } from "express";
import { formatZodError, isZodError } from "./validate";

type ApiErrorBody = {
  error: string;
};

type MalformedJsonError = SyntaxError & {
  status?: number;
  type?: string;
};

function isMalformedJsonError(error: unknown): error is MalformedJsonError {
  return (
    error instanceof SyntaxError &&
    (error as MalformedJsonError).status === 400 &&
    (error as MalformedJsonError).type === "entity.parse.failed"
  );
}

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

  if (isMalformedJsonError(err)) {
    return res.status(400).json({ error: "Malformed JSON body" });
  }

  console.error(err);

  res.status(500).json({ error: "Internal Server Error" });
}
