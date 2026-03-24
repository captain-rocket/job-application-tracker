import { z } from "zod";
import { requiredString, requiredTrimmedString } from "./utils/helpers";

const emailSchema = requiredTrimmedString("email")
  .pipe(z.email({ error: "email must be a valid email address" }))
  .transform((value) => value.toLowerCase());

const passwordSchema = requiredString("password");

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema.min(8, "password must be at least 8 characters"),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
