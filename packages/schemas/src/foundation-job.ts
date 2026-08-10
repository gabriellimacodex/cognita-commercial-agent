import { z } from "zod";

export const FOUNDATION_QUEUE_NAME = "foundation-jobs";
export const FOUNDATION_JOB_NAME = "process-foundation-job";

export const foundationJobStatusSchema = z.enum([
  "pending",
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const foundationJobInputSchema = z.object({
  input: z.string().min(1).max(10_000),
});

export const foundationJobQueueMessageSchema = z.object({
  jobId: z.uuid(),
  correlationId: z.string().min(1).max(128),
});

const foundationJobResultSchema = z.object({
  algorithm: z.literal("sha256"),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  inputBytes: z.number().int().nonnegative(),
});

export const foundationJobSchema = z
  .object({
    id: z.uuid(),
    status: foundationJobStatusSchema,
    publishAttempts: z.number().int().nonnegative(),
    processAttempts: z.number().int().nonnegative(),
    lastErrorCode: z.string().nullable().optional(),
    queuedAt: z.iso.datetime().nullable().optional(),
    processingStartedAt: z.iso.datetime().nullable().optional(),
    completedAt: z.iso.datetime().nullable().optional(),
    failedAt: z.iso.datetime().nullable().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    result: foundationJobResultSchema.nullable().optional(),
  })
  .superRefine((job, context) => {
    if (job.status === "completed" && job.result == null) {
      context.addIssue({
        code: "custom",
        message: "Completed jobs require a persisted result",
        path: ["result"],
      });
    }
  });

export type FoundationJobInput = z.infer<typeof foundationJobInputSchema>;
export type FoundationJob = z.infer<typeof foundationJobSchema>;
export type FoundationJobQueueMessage = z.infer<
  typeof foundationJobQueueMessageSchema
>;
export type FoundationJobStatus = z.infer<typeof foundationJobStatusSchema>;
