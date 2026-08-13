import { describe, expect, it } from "vitest";

import { alignEvidenceQuote } from "./evidence-alignment.js";

describe("deterministic Evidence alignment edge cases", () => {
  it.each([
    ["", "", "evidence_quote_empty"],
    ["mensagem", "ausente", "evidence_quote_not_found"],
    ["CRM e CRM", "CRM", "evidence_quote_multiple_matches"],
    ["ação", "ação", "evidence_quote_not_found"],
    ["😀😀 texto", "😀 texto", null],
    ["a😀b😀c", "b😀c", null],
  ] as const)("aligns %s / %s categorically", (message, quote, error) => {
    const result = alignEvidenceQuote(message, quote);
    if (error == null) expect(result.valid).toBe(true);
    else expect(result).toEqual({ valid: false, validationCode: error });
  });

  it("finds overlapping occurrences instead of choosing one", () => {
    expect(alignEvidenceQuote("aaa", "aa")).toEqual({
      valid: false,
      validationCode: "evidence_quote_multiple_matches",
    });
  });
});
