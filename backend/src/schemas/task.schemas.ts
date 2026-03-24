import { z } from "zod";
import {
  requiredTrimmedString,
  optionalNonEmptyTrimmedString,
} from "./utils/helpers";

const positiveIntId = z.string().regex(/^[1-9]\d*$/, "Invalid id");

export const taskIdParamsSchema = z.object({
  id: positiveIntId,
});

export const createTaskBodySchema = z.object({
  title: requiredTrimmedString("title"),
});

export const updateTaskBodySchema = z
  .object({
    title: optionalNonEmptyTrimmedString("title").optional(),
    completed: z.boolean().optional(),
  })
  .refine((data) => data.title !== undefined || data.completed !== undefined, {
    message: "Provide title and/or completed",
  });

export type TaskIdParams = z.infer<typeof taskIdParamsSchema>;
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
