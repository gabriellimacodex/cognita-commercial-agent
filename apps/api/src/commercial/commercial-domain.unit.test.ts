import { describe, expect, it } from "vitest";

import {
  assertOpportunityTransition,
  hashCommercialCommand,
  InvalidCnpjError,
  InvalidCommercialTransitionError,
  normalizeCnpj,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
} from "./commercial-domain.js";

describe("commercial domain rules", () => {
  it("accepts only transitions defined by ADR 008", () => {
    expect(() =>
      assertOpportunityTransition("open", "discovery"),
    ).not.toThrow();
    expect(() =>
      assertOpportunityTransition("nurture", "discovery"),
    ).not.toThrow();
    expect(() => assertOpportunityTransition("won", "lost")).toThrow(
      InvalidCommercialTransitionError,
    );
    expect(() => assertOpportunityTransition("discovery", "proposal")).toThrow(
      InvalidCommercialTransitionError,
    );
  });

  it("normalizes only deterministic identity fields", () => {
    expect(normalizeDomain("HTTPS://Example.COM/")).toBe("example.com");
    expect(normalizeEmail(" Person@Example.COM ")).toBe("person@example.com");
    expect(normalizePhone("+55 (11) 99999-0000")).toBe("+5511999990000");
    expect(normalizeCnpj("04.252.011/0001-10")).toBe("04252011000110");
    expect(() => normalizeCnpj("11.111.111/1111-11")).toThrow(InvalidCnpjError);
  });

  it("creates a stable command hash independent of object key order", () => {
    const first = hashCommercialCommand(
      "00000000-0000-4000-8000-000000000001",
      "create_company_v1",
      {},
      { name: "Cognita", domain: "cognita.test" },
      "founder",
    );
    const second = hashCommercialCommand(
      "00000000-0000-4000-8000-000000000001",
      "create_company_v1",
      {},
      { domain: "cognita.test", name: "Cognita" },
      "founder",
    );
    expect(first).toBe(second);
  });
});
