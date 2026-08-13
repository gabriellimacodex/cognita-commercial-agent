"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import {
  applyCommercialActionCandidate,
  createCommercialActionPlan,
  evaluateCommercialActionCandidate,
  executeCommercialCommand,
  executeCommercialDecision,
  resolveCommercialCandidate,
  startCommercialInterpretation,
} from "../../lib/commercial-api";

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
  const measuresConversion =
    required(formData, "measuresConversion") === "true";
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
    const observedAt = new Date().toISOString();
    const facts = [
      ["company_ownership_type", "private"],
      ["has_existing_sales_process", true],
      ["uses_crm", true],
      ["seller_count", 3],
      ["commercial_owner_defined", true],
      ["has_recurring_inbound", true],
      ["monthly_lead_volume", 500],
      ["average_ticket_brl_cents", 500_000],
      ["measures_conversion", measuresConversion],
      ["roi_provable_within_90_days", true],
      ["pain_confirmed", true],
      ["pain_recurring", true],
      ["pain_measurable", true],
    ] as const;
    for (const [factKey, value] of facts) {
      const pain = factKey.startsWith("pain_");
      await executeCommercialCommand(
        `/commercial/leads/${lead.targetId}/facts`,
        "POST",
        {
          organizationId,
          factKey,
          factSchemaVersion: 1,
          value,
          sourceType: "human_declaration",
          sourceRef: actorRef,
          declarerRef: actorRef,
          executorRef: actorRef,
          observedAt,
          ...(pain
            ? {
                evidence: {
                  type: "human_attestation",
                  ref: "cockpit-standard-fit",
                },
              }
            : {}),
        },
      );
    }
    const policyDecision = await executeCommercialDecision(
      lead.targetId ?? "",
      {
        organizationId,
        requestedAction: "create_opportunity",
        authorityType: "policy",
        authorityRef: "opportunity-eligibility@1.0.0",
        executorRef: actorRef,
      },
    );
    const opportunityDecision =
      policyDecision.outcome === "require_human_review"
        ? await executeCommercialDecision(lead.targetId ?? "", {
            organizationId,
            requestedAction: "create_opportunity",
            authorityType: "declared_human",
            authorityRef: actorRef,
            executorRef: actorRef,
            reasonCode: "conversion_measurement_gap",
            evidence: {
              type: "human_attestation",
              ref: "cockpit-human-review",
            },
          })
        : policyDecision;
    if (opportunityDecision.outcome !== "allow") {
      throw new Error("Opportunity decision did not authorize the action");
    }
    const opportunity = await executeCommercialCommand(
      "/commercial/opportunities",
      "POST",
      {
        organizationId,
        leadId: lead.targetId,
        decisionId: opportunityDecision.id,
        actorRef,
      },
    );
    const discoveryDecision = await executeCommercialDecision(
      lead.targetId ?? "",
      {
        organizationId,
        opportunityId: opportunity.targetId,
        requestedAction: "transition_to_discovery",
        authorityType: "policy",
        authorityRef: "commercial-state-gates@1.0.0",
        executorRef: actorRef,
      },
    );
    await executeCommercialCommand(
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      "POST",
      {
        organizationId,
        toState: "discovery",
        reasonCode: "discovery_started",
        decisionId: discoveryDecision.id,
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

export async function prepareCommercialIntelligenceMessage(
  formData: FormData,
): Promise<never> {
  const organizationId = randomUUID();
  const actorRef = "local-founder";
  try {
    await executeCommercialCommand("/commercial/organizations", "POST", {
      organizationId,
      name: "Synthetic Intelligence",
      actorRef,
    });
    const contact = await executeCommercialCommand(
      "/commercial/contacts",
      "POST",
      {
        organizationId,
        name: "Synthetic Contact",
        email: `${randomUUID()}@example.test`,
        actorRef,
      },
    );
    const lead = await executeCommercialCommand("/commercial/leads", "POST", {
      organizationId,
      contactId: contact.targetId,
      source: "cockpit-intelligence",
      actorRef,
    });
    const conversation = await executeCommercialCommand(
      "/commercial/conversations",
      "POST",
      {
        organizationId,
        leadId: lead.targetId,
        channel: "synthetic",
        externalNamespace: "cockpit-intelligence",
        actorRef,
      },
    );
    const message = await executeCommercialCommand(
      `/commercial/conversations/${conversation.targetId}/messages`,
      "POST",
      {
        organizationId,
        body: required(formData, "intelligenceMessage"),
        occurredAt: new Date().toISOString(),
        actorRef,
      },
    );
    redirect(
      `/commercial?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(lead.targetId ?? "")}&messageId=${encodeURIComponent(message.targetId ?? "")}`,
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error != null &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    )
      throw error;
    redirect("/commercial?error=Commercial%20intelligence%20slice%20failed");
  }
}

export async function interpretSelectedCommercialMessage(
  formData: FormData,
): Promise<never> {
  const organizationId = required(formData, "organizationId");
  const leadId = required(formData, "leadId");
  const messageId = required(formData, "messageId");
  const run = await startCommercialInterpretation(messageId, {
    organizationId,
    executorRef: "cockpit-local",
  });
  const baselineDecision = await executeCommercialDecision(leadId, {
    organizationId,
    requestedAction: "create_opportunity",
    authorityType: "policy",
    authorityRef: "opportunity-eligibility@1.0.0",
    executorRef: "cockpit-local",
  });
  redirect(
    `/commercial?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}&messageId=${encodeURIComponent(messageId)}&runId=${encodeURIComponent(run.id)}&baselineDecisionId=${encodeURIComponent(baselineDecision.id)}`,
  );
}

export async function resolveIntelligenceCandidate(
  formData: FormData,
): Promise<never> {
  const organizationId = required(formData, "organizationId");
  const leadId = required(formData, "leadId");
  const messageId = required(formData, "messageId");
  const runId = required(formData, "runId");
  const candidateId = required(formData, "candidateId");
  const resolution = required(formData, "resolution");
  const baselineDecisionId = required(formData, "baselineDecisionId");
  if (resolution === "confirm") {
    const mode = required(formData, "confirmationMode");
    await resolveCommercialCandidate(candidateId, "confirm", {
      organizationId,
      authorityType: "declared_human",
      authorityRef: "local-founder",
      executorRef: "cockpit-local",
      mode,
      correctsFactIds:
        mode === "correct"
          ? formData
              .getAll("correctsFactIds")
              .filter((value): value is string => typeof value === "string")
          : [],
    });
  } else {
    await resolveCommercialCandidate(candidateId, "reject", {
      organizationId,
      authorityType: "declared_human",
      authorityRef: "local-founder",
      executorRef: "cockpit-local",
      reasonCode: "incorrect_extraction",
    });
  }
  redirect(
    `/commercial?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}&messageId=${encodeURIComponent(messageId)}&runId=${encodeURIComponent(runId)}&baselineDecisionId=${encodeURIComponent(baselineDecisionId)}`,
  );
}

export async function evaluateIntelligenceDecision(
  formData: FormData,
): Promise<never> {
  const organizationId = required(formData, "organizationId");
  const leadId = required(formData, "leadId");
  const messageId = required(formData, "messageId");
  const runId = required(formData, "runId");
  const baselineDecisionId = required(formData, "baselineDecisionId");
  await executeCommercialDecision(leadId, {
    organizationId,
    requestedAction: "create_opportunity",
    authorityType: "policy",
    authorityRef: "opportunity-eligibility@1.0.0",
    executorRef: "cockpit-local",
  });
  redirect(
    `/commercial?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}&messageId=${encodeURIComponent(messageId)}&runId=${encodeURIComponent(runId)}&baselineDecisionId=${encodeURIComponent(baselineDecisionId)}`,
  );
}

export async function prepareCommercialActionPlan(
  formData: FormData,
): Promise<never> {
  const scenario = required(formData, "planningScenario");
  const organizationId = randomUUID();
  const actorRef = "local-founder";
  try {
    await executeCommercialCommand("/commercial/organizations", "POST", {
      organizationId,
      name: "Synthetic Action Planning",
      actorRef,
    });
    const contact = await executeCommercialCommand(
      "/commercial/contacts",
      "POST",
      {
        organizationId,
        name: "Synthetic Planning Contact",
        email: `${randomUUID()}@example.test`,
        actorRef,
      },
    );
    const lead = await executeCommercialCommand("/commercial/leads", "POST", {
      organizationId,
      contactId: contact.targetId,
      source: "cockpit-action-planning",
      actorRef,
    });
    if (scenario !== "missing") {
      const facts = [
        ["company_ownership_type", "private"],
        ["has_existing_sales_process", true],
        ["uses_crm", true],
        ["seller_count", 3],
        ["commercial_owner_defined", true],
        ["has_recurring_inbound", true],
        ["monthly_lead_volume", 500],
        ["average_ticket_brl_cents", 500_000],
        ["measures_conversion", scenario !== "review"],
        ["roi_provable_within_90_days", true],
        ["pain_confirmed", true],
        ["pain_recurring", true],
        ["pain_measurable", true],
      ] as const;
      for (const [factKey, value] of facts) {
        await executeCommercialCommand(
          `/commercial/leads/${lead.targetId}/facts`,
          "POST",
          {
            organizationId,
            factKey,
            factSchemaVersion: 1,
            value,
            sourceType: "human_declaration",
            sourceRef: actorRef,
            declarerRef: actorRef,
            executorRef: "cockpit-local",
            observedAt: new Date().toISOString(),
            ...(factKey.startsWith("pain_")
              ? {
                  evidence: {
                    type: "human_attestation",
                    ref: "cockpit-action-planning",
                  },
                }
              : {}),
          },
        );
      }
    }
    const plan = await createCommercialActionPlan(lead.targetId ?? "", {
      organizationId,
      executorRef: "cockpit-local",
    });
    redirect(
      `/commercial?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(lead.targetId ?? "")}&actionPlanId=${encodeURIComponent(plan.id)}`,
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error != null &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    )
      throw error;
    redirect("/commercial?error=Commercial%20action%20planning%20failed");
  }
}

export async function submitCommercialActionCandidate(
  formData: FormData,
): Promise<never> {
  const organizationId = required(formData, "organizationId");
  const leadId = required(formData, "leadId");
  const actionPlanId = required(formData, "actionPlanId");
  const candidateId = required(formData, "candidateId");
  const requestedAction = required(formData, "requestedAction");
  const capability = required(formData, "requiredCapabilityKey");
  const human = capability === "review_commercial_exception_v1";
  const reasonCode = formData.get("reasonCode");
  await evaluateCommercialActionCandidate(candidateId, {
    organizationId,
    authorityType: human ? "declared_human" : "policy",
    authorityRef: human
      ? "local-founder"
      : requestedAction === "create_opportunity"
        ? "opportunity-eligibility@1.0.0"
        : "commercial-state-gates@1.0.0",
    executorRef: "cockpit-local",
    ...(human && typeof reasonCode === "string"
      ? {
          reasonCode,
          evidence: {
            type: "human_attestation",
            ref: "cockpit-action-review",
          },
        }
      : {}),
  });
  redirect(
    `/commercial?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}&actionPlanId=${encodeURIComponent(actionPlanId)}`,
  );
}

export async function applyPlannedCommercialAction(
  formData: FormData,
): Promise<never> {
  const organizationId = required(formData, "organizationId");
  const leadId = required(formData, "leadId");
  const actionPlanId = required(formData, "actionPlanId");
  const candidateId = required(formData, "candidateId");
  const receipt = await applyCommercialActionCandidate(candidateId, {
    organizationId,
    executorRef: "cockpit-local",
  });
  redirect(
    `/commercial?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}&actionPlanId=${encodeURIComponent(actionPlanId)}&applicationTargetId=${encodeURIComponent(receipt.targetId ?? "")}`,
  );
}
