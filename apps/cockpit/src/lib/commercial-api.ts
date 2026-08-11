import { randomUUID } from "node:crypto";

import {
  apiErrorSchema,
  commercialCommandReceiptSchema,
  commercialDecisionContextSchema,
  commercialDecisionSchema,
  commercialTimelineSchema,
  leadContextSchema,
  type CommercialCommandReceipt,
  type CommercialDecision,
  type CommercialDecisionContext,
  type CommercialTimeline,
  type LeadContext,
} from "@cognita/schemas";

function apiUrl(): string {
  const value = process.env.API_INTERNAL_URL;
  if (value == null) throw new Error("API_INTERNAL_URL is required");
  return new URL(value).toString().replace(/\/$/, "");
}

async function parseResponse(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    throw new Error(
      error.success
        ? error.data.error.message
        : "Commercial API request failed",
    );
  }
  return body;
}

export async function executeCommercialCommand(
  path: string,
  method: "POST" | "PUT",
  payload: unknown,
): Promise<CommercialCommandReceipt> {
  const response = await fetch(`${apiUrl()}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      "x-correlation-id": randomUUID(),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  return commercialCommandReceiptSchema.parse(await parseResponse(response));
}

export async function executeCommercialDecision(
  leadId: string,
  payload: unknown,
): Promise<CommercialDecision> {
  const response = await fetch(
    `${apiUrl()}/commercial/leads/${encodeURIComponent(leadId)}/decisions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
        "x-correlation-id": randomUUID(),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    },
  );
  return commercialDecisionSchema.parse(await parseResponse(response));
}

export async function getLeadContext(
  organizationId: string,
  leadId: string,
): Promise<LeadContext> {
  const response = await fetch(
    `${apiUrl()}/commercial/leads/${encodeURIComponent(leadId)}/context?organizationId=${encodeURIComponent(organizationId)}`,
    { cache: "no-store", signal: AbortSignal.timeout(3_000) },
  );
  return leadContextSchema.parse(await parseResponse(response));
}

export async function getLeadTimeline(
  organizationId: string,
  leadId: string,
): Promise<CommercialTimeline> {
  const response = await fetch(
    `${apiUrl()}/commercial/leads/${encodeURIComponent(leadId)}/timeline?organizationId=${encodeURIComponent(organizationId)}&limit=100`,
    { cache: "no-store", signal: AbortSignal.timeout(3_000) },
  );
  return commercialTimelineSchema.parse(await parseResponse(response));
}

export async function getDecisionContext(
  organizationId: string,
  leadId: string,
): Promise<CommercialDecisionContext> {
  const response = await fetch(
    `${apiUrl()}/commercial/leads/${encodeURIComponent(leadId)}/decision-context?organizationId=${encodeURIComponent(organizationId)}`,
    { cache: "no-store", signal: AbortSignal.timeout(3_000) },
  );
  return commercialDecisionContextSchema.parse(await parseResponse(response));
}
