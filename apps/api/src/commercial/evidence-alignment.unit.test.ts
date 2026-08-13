import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { alignEvidenceQuote } from "./evidence-alignment.js";

describe("deterministic Evidence alignment", () => {
  it("derives Unicode code point offsets and digest for one literal match", () => {
    const message = "Olá 👋, temos três vendedores.";
    const quote = "temos três vendedores";

    expect(alignEvidenceQuote(message, quote)).toEqual({
      valid: true,
      startOffset: 7,
      endOffset: 28,
      spanDigest: createHash("sha256").update(quote).digest("hex"),
    });
  });
});
