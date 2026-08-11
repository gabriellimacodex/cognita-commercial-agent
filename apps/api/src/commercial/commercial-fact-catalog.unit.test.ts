import { describe, expect, it } from "vitest";

import { createCommercialFactInputSchema } from "@cognita/schemas";

import {
  InvalidCommercialFactError,
  validateCommercialFact,
} from "./commercial-fact-catalog.js";

const base = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  factSchemaVersion: 1 as const,
  sourceType: "human_declaration" as const,
  sourceRef: "human:test",
  declarerRef: "human:test",
  executorRef: "test",
  observedAt: "2026-08-11T12:00:00.000Z",
  correctsFactIds: [],
};

describe("commercial Fact catalog", () => {
  it("preserves known false as a valid boolean Fact", () => {
    const input = createCommercialFactInputSchema.parse({
      ...base,
      factKey: "measures_conversion",
      value: false,
    });
    expect(validateCommercialFact(input)).toBe("boolean");
  });

  it("requires evidence for pain Facts", () => {
    const input = createCommercialFactInputSchema.parse({
      ...base,
      factKey: "pain_confirmed",
      value: true,
    });
    expect(() => validateCommercialFact(input)).toThrow(
      InvalidCommercialFactError,
    );
  });

  it("rejects a value outside the closed enum", () => {
    const input = createCommercialFactInputSchema.parse({
      ...base,
      factKey: "timing_status",
      value: "soon",
    });
    expect(() => validateCommercialFact(input)).toThrow(
      InvalidCommercialFactError,
    );
  });

  it("rejects a nurture revisit timestamp that is not in the future", () => {
    const input = createCommercialFactInputSchema.parse({
      ...base,
      factKey: "revisit_at",
      value: "2000-01-01T00:00:00.000Z",
    });
    expect(() => validateCommercialFact(input)).toThrow(
      InvalidCommercialFactError,
    );
  });
});
