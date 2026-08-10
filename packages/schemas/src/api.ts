import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string(),
  dependencies: z.record(z.string(), z.enum(["ok", "unavailable"])).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type Health = z.infer<typeof healthSchema>;
