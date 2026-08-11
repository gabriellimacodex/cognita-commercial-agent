import { createHash } from "node:crypto";

import type { OpportunityState } from "@cognita/schemas";

const transitions: Readonly<
  Record<OpportunityState, readonly OpportunityState[]>
> = {
  open: ["discovery", "nurture", "lost", "disqualified"],
  discovery: ["qualified", "nurture", "lost", "disqualified"],
  qualified: ["proposal", "nurture", "lost"],
  proposal: ["negotiation", "won", "nurture", "lost"],
  negotiation: ["won", "nurture", "lost"],
  nurture: ["discovery", "lost", "disqualified"],
  won: [],
  lost: [],
  disqualified: [],
};

export class InvalidCommercialTransitionError extends Error {
  public constructor(from: OpportunityState, to: OpportunityState) {
    super(`Commercial state transition ${from} -> ${to} is not allowed`);
    this.name = "InvalidCommercialTransitionError";
  }
}

export class InvalidCnpjError extends Error {
  public constructor() {
    super("CNPJ must contain valid check digits");
    this.name = "InvalidCnpjError";
  }
}

export function assertOpportunityTransition(
  from: OpportunityState,
  to: OpportunityState,
): void {
  if (!transitions[from].includes(to)) {
    throw new InvalidCommercialTransitionError(from, to);
  }
}

export function normalizeDomain(value: string | undefined): string | null {
  if (value == null) return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export function normalizeEmail(value: string | undefined): string | null {
  return value?.trim().toLowerCase() ?? null;
}

export function normalizePhone(value: string | undefined): string | null {
  if (value == null) return null;
  const hasPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  return `${hasPlus ? "+" : ""}${digits}`;
}

function checkCnpjDigit(digits: number[], weights: number[]): number {
  const sum = weights.reduce(
    (total, weight, index) => total + (digits[index] ?? 0) * weight,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function normalizeCnpj(value: string | undefined): string | null {
  if (value == null) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    throw new InvalidCnpjError();
  }
  const numbers = [...digits].map(Number);
  const first = checkCnpjDigit(numbers, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkCnpjDigit(
    [...numbers.slice(0, 12), first],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  if (numbers[12] !== first || numbers[13] !== second) {
    throw new InvalidCnpjError();
  }
  return digits;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function hashCommercialCommand(
  organizationId: string,
  commandType: string,
  routeParameters: Record<string, string>,
  semanticBody: unknown,
  actorRef: string,
): string {
  return hashCanonical({
    version: 1,
    organizationId,
    commandType,
    routeParameters,
    semanticBody,
    actorRef,
  });
}
