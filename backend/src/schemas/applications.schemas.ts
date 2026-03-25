import { z } from "zod";
import {
  optionalNonEmptyTrimmedString,
  requiredTrimmedString,
} from "./utils/helpers";

const positiveApplicationId = z
  .string()
  .regex(/^[1-9]\d*$/, "Invalid application id");

const nullableTrimmedString = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  });

const optionalNullableTrimmedString = nullableTrimmedString.optional();

export const applicationStatusSchema = z.enum(
  ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"],
  { error: "Invalid status" },
);

export const applicationIdParamsSchema = z.object({
  id: positiveApplicationId,
});

export const listApplicationsQuerySchema = z.object({
  status: applicationStatusSchema.optional(),
  page: z.coerce.number().int().min(1, "page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "limit must be at least 1")
    .max(50, "limit must be at most 50")
    .default(50),
});

export const createApplicationBodySchema = z.object({
  company: requiredTrimmedString("company"),
  job_title: requiredTrimmedString("job_title"),
  status: applicationStatusSchema.optional(),
  job_url: optionalNullableTrimmedString,
  location: optionalNullableTrimmedString,
  notes: optionalNullableTrimmedString,
  applied_at: optionalNullableTrimmedString,
});

export const updateApplicationBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z
    .object({
      company: optionalNonEmptyTrimmedString("company").optional(),
      job_title: optionalNonEmptyTrimmedString("job_title").optional(),
      status: applicationStatusSchema.optional(),
      job_url: optionalNullableTrimmedString,
      location: optionalNullableTrimmedString,
      notes: optionalNullableTrimmedString,
      applied_at: optionalNullableTrimmedString,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "No valid fields provided for update",
    }),
);

export type ApplicationIdParams = z.infer<typeof applicationIdParamsSchema>;
export type CreateApplicationBody = z.infer<typeof createApplicationBodySchema>;
export type UpdateApplicationBody = z.infer<typeof updateApplicationBodySchema>;
