import { z } from "zod";

export function requiredString(fieldName: string) {
  const msg = `${fieldName} is required`;
  return z.string({ error: msg }).min(1, msg);
}

export function requiredTrimmedString(fieldName: string) {
  const msg = `${fieldName} is required`;
  return z.string({ error: msg }).trim().min(1, msg);
}

export function optionalNonEmptyTrimmedString(fieldName: string) {
  return z.string().trim().min(1, `${fieldName} cannot be empty`);
}
