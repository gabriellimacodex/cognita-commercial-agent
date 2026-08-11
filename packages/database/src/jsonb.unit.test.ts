import { describe, expect, it } from "vitest";

import { serializeJsonb } from "./jsonb.js";

describe("serializeJsonb", () => {
  it("preserves JSON semantics for every supported persistence shape", () => {
    const values = [
      "private",
      false,
      3,
      ["fact_unknown", "conversion_measurement_gap"],
      {
        policy: { key: "opportunity-eligibility", version: "1.0.0" },
        facts: { measuresConversion: false },
      },
      [],
    ] as const;

    for (const value of values) {
      const serialized = serializeJsonb(value);

      expect(JSON.parse(serialized)).toEqual(value);
      expect(JSON.parse(serialized)).not.toEqual(serialized);
    }
  });
});
