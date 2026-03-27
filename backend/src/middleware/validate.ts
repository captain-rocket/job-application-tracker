import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";

type RequestTarget = "body" | "params" | "query";

function formatZodError(error: ZodError): string {
  const firstIssue = error.issues[0];

  if (!firstIssue) {
    return "Invalid request data";
  }
  return firstIssue.message;
}

function validate(schema: ZodType, target: RequestTarget) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[target]);

      if (target === "query") {
        Object.defineProperty(req, "query", {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else {
        (req as Request & Record<Exclude<RequestTarget, "query">, unknown>)[
          target
        ] = parsed;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateBody(schema: ZodType) {
  return validate(schema, "body");
}
export function validateParams(schema: ZodType) {
  return validate(schema, "params");
}

export function validateQuery(schema: ZodType) {
  return validate(schema, "query");
}
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

export { formatZodError };
