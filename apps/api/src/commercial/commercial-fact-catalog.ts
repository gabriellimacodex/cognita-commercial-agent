import type {
  CommercialFactKey,
  CreateCommercialFactInput,
} from "@cognita/schemas";

export class InvalidCommercialFactError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidCommercialFactError";
  }
}

const booleanKeys = new Set<CommercialFactKey>([
  "has_existing_sales_process",
  "uses_crm",
  "commercial_owner_defined",
  "has_recurring_inbound",
  "measures_conversion",
  "roi_provable_within_90_days",
  "pain_confirmed",
  "pain_recurring",
  "pain_measurable",
  "decision_maker_access_confirmed",
  "budget_confirmed",
  "operational_capacity_confirmed",
]);
const integerKeys = new Set<CommercialFactKey>([
  "seller_count",
  "monthly_lead_volume",
  "average_ticket_brl_cents",
  "sales_cycle_days",
]);
const evidenceRequired = new Set<CommercialFactKey>([
  "pain_confirmed",
  "pain_recurring",
  "pain_measurable",
]);

const enumValues: Partial<Record<CommercialFactKey, readonly string[]>> = {
  company_ownership_type: [
    "private",
    "public",
    "government",
    "nonprofit",
    "other",
  ],
  timing_status: [
    "available_now",
    "temporarily_unavailable",
    "no_active_timing",
  ],
  nurture_return_condition: [
    "timing_window_opens",
    "budget_cycle_opens",
    "decision_process_resumes",
    "operational_capacity_available",
    "initiative_resumes",
  ],
};

export function validateCommercialFact(
  input: CreateCommercialFactInput,
): "boolean" | "integer" | "string" | "timestamp" {
  if (evidenceRequired.has(input.factKey) && input.evidence == null) {
    throw new InvalidCommercialFactError(`${input.factKey} requires evidence`);
  }
  if (booleanKeys.has(input.factKey)) {
    if (typeof input.value !== "boolean")
      throw new InvalidCommercialFactError(`${input.factKey} must be boolean`);
    return "boolean";
  }
  if (integerKeys.has(input.factKey)) {
    if (
      typeof input.value !== "number" ||
      !Number.isInteger(input.value) ||
      input.value < 0 ||
      (input.factKey === "sales_cycle_days" && input.value === 0)
    ) {
      throw new InvalidCommercialFactError(
        `${input.factKey} must be a valid integer`,
      );
    }
    return "integer";
  }
  if (input.factKey === "revisit_at") {
    if (
      typeof input.value !== "string" ||
      Number.isNaN(Date.parse(input.value)) ||
      Date.parse(input.value) <= Date.now()
    )
      throw new InvalidCommercialFactError(
        "revisit_at must be a future timestamp",
      );
    return "timestamp";
  }
  const allowed = enumValues[input.factKey];
  if (
    allowed == null ||
    typeof input.value !== "string" ||
    !allowed.includes(input.value)
  ) {
    throw new InvalidCommercialFactError(
      `${input.factKey} must use its closed enum`,
    );
  }
  return "string";
}
