import { z } from "zod";

const requiredTrimmedString = (fieldName: string) => {
  const msg = `${fieldName} is required`;
  return z.string({ error: msg }).trim().min(1, msg);
};

const emailSchema = requiredTrimmedString("email")
  .pipe(z.email({ error: "email must be a valid email address" }))
  .transform((value) => value.toLowerCase());

const passwordSchema = requiredTrimmedString("password");

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema.min(8, "password must be at least 8 characters"),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
