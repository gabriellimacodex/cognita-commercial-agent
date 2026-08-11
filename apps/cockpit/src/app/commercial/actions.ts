"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { executeCommercialCommand } from "../../lib/commercial-api";

function required(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

export async function runCommercialVerticalSlice(
  formData: FormData,
): Promise<never> {
  const organizationId = randomUUID();
  const actorRef = "local-founder";
  try {
    await executeCommercialCommand("/commercial/organizations", "POST", {
      organizationId,
      name: required(formData, "organizationName"),
      actorRef,
    });
    const company = await executeCommercialCommand(
      "/commercial/companies",
      "POST",
      {
        organizationId,
        name: required(formData, "companyName"),
        domain: required(formData, "companyDomain"),
        actorRef,
      },
    );
    const contact = await executeCommercialCommand(
      "/commercial/contacts",
      "POST",
      {
        organizationId,
        name: required(formData, "contactName"),
        email: required(formData, "contactEmail"),
        actorRef,
      },
    );
    await executeCommercialCommand(
      `/commercial/contacts/${contact.targetId}/company`,
      "PUT",
      { organizationId, companyId: company.targetId, actorRef },
    );
    const lead = await executeCommercialCommand("/commercial/leads", "POST", {
      organizationId,
      contactId: contact.targetId,
      source: required(formData, "leadSource"),
      actorRef,
    });
    await executeCommercialCommand(
      `/commercial/leads/${lead.targetId}/company`,
      "PUT",
      { organizationId, companyId: company.targetId, actorRef },
    );
    await executeCommercialCommand(
      `/commercial/leads/${lead.targetId}/assignments`,
      "POST",
      {
        organizationId,
        assigneeRef: required(formData, "assigneeRef"),
        actorRef,
      },
    );
    const conversation = await executeCommercialCommand(
      "/commercial/conversations",
      "POST",
      {
        organizationId,
        leadId: lead.targetId,
        channel: required(formData, "channel"),
        externalNamespace: "cockpit-local",
        actorRef,
      },
    );
    await executeCommercialCommand(
      `/commercial/conversations/${conversation.targetId}/messages`,
      "POST",
      {
        organizationId,
        body: required(formData, "messageBody"),
        occurredAt: new Date().toISOString(),
        actorRef,
      },
    );
    const opportunity = await executeCommercialCommand(
      "/commercial/opportunities",
      "POST",
      { organizationId, leadId: lead.targetId, actorRef },
    );
    await executeCommercialCommand(
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      "POST",
      {
        organizationId,
        toState: "discovery",
        reasonCode: "vertical_slice_started",
        actorRef,
      },
    );
    redirect(
      `/commercial?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(lead.targetId ?? "")}`,
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error != null &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect("/commercial?error=Commercial%20vertical%20slice%20failed");
  }
}
