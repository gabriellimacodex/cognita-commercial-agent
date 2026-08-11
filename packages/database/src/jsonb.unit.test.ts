import { createCommercialFactInputSchema } from "@cognita/schemas";
import { describe, expect, it } from "vitest";

import { serializeJsonb } from "./jsonb.js";

function deserializeJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

describe("serializeJsonb", () => {
  it("preserves JSON semantics for every supported persistence shape", () => {
    const values = [
      "private",
      true,
      500,
      null,
      ["fact_unknown", "conversion_measurement_gap"],
      [],
      { a: 1 },
      {
        policy: { key: "opportunity-eligibility", version: "1.0.0" },
        facts: { measuresConversion: false },
      },
    ] as const;

    for (const value of values) {
      const serialized = serializeJsonb(value);

      expect(deserializeJson(serialized)).toEqual(value);
      expect(deserializeJson(serialized)).not.toEqual(serialized);
    }

    expect(typeof deserializeJson(serializeJsonb("private"))).toBe("string");
    expect(typeof deserializeJson(serializeJsonb(true))).toBe("boolean");
    expect(typeof deserializeJson(serializeJsonb(500))).toBe("number");
    expect(deserializeJson(serializeJsonb(null))).toBeNull();
    expect(Array.isArray(deserializeJson(serializeJsonb(["a", "b"])))).toBe(
      true,
    );
    expect(Array.isArray(deserializeJson(serializeJsonb([])))).toBe(true);
    expect(typeof deserializeJson(serializeJsonb({ a: 1 }))).toBe("object");
  });

  it("keeps round-tripped Fact scalars compatible with the existing Zod schema", () => {
    const cases = [
      { factKey: "company_ownership_type", value: "private" },
      { factKey: "uses_crm", value: true },
      { factKey: "monthly_lead_volume", value: 500 },
    ] as const;

    for (const item of cases) {
      const roundTripped = deserializeJson(serializeJsonb(item.value));
      const parsed = createCommercialFactInputSchema.parse({
        organizationId: "00000000-0000-4000-8000-000000000001",
        factKey: item.factKey,
        factSchemaVersion: 1,
        value: roundTripped,
        sourceType: "human_declaration",
        sourceRef: "jsonb-regression",
        declarerRef: "human:jsonb-regression",
        executorRef: "test:jsonb-regression",
        observedAt: "2026-08-11T00:00:00.000Z",
        correctsFactIds: [],
      });

      expect(parsed.value).toEqual(item.value);
    }
  });
});
