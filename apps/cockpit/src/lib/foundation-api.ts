import { randomUUID } from "node:crypto";

import {
  apiErrorSchema,
  foundationJobSchema,
  healthSchema,
  type FoundationJob,
  type Health,
} from "@cognita/schemas";

function apiUrl(): string {
  const value = process.env.API_INTERNAL_URL;
  if (value == null) throw new Error("API_INTERNAL_URL is required");
  return new URL(value).toString().replace(/\/$/, "");
}

export async function createFoundationJob(
  input: string,
): Promise<FoundationJob> {
  const response = await fetch(`${apiUrl()}/foundation/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      "x-correlation-id": randomUUID(),
    },
    body: JSON.stringify({ input }),
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    throw new Error(
      error.success ? error.data.error.message : "API request failed",
    );
  }
  return foundationJobSchema.parse(body);
}

export async function getFoundationJob(id: string): Promise<FoundationJob> {
  const response = await fetch(
    `${apiUrl()}/foundation/jobs/${encodeURIComponent(id)}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    },
  );
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    throw new Error(
      error.success ? error.data.error.message : "API request failed",
    );
  }
  return foundationJobSchema.parse(body);
}

export async function getServiceHealth(
  url: string,
  service = new URL(url).hostname,
): Promise<Health> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error("service unavailable");
    const body: unknown = await response.json();
    const internalHealth = healthSchema.safeParse(body);
    if (internalHealth.success) {
      return { ...internalHealth.data, service };
    }
    if (
      typeof body === "object" &&
      body != null &&
      "status" in body &&
      body.status === "ok"
    ) {
      return { status: "ok", service };
    }
    throw new Error("invalid readiness response");
  } catch {
    return { status: "degraded", service };
  }
}
