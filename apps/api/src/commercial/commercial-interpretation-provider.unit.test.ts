import { describe, expect, it, vi } from "vitest";

import {
  FakeCommercialInterpretationProvider,
  OpenAiCommercialInterpretationProvider,
  interpretationInstruction,
  interpretationInstructionMetadata,
} from "./commercial-interpretation-provider.js";

const syntheticMessage =
  "Hoje entram uns 800 leads por mês, temos quatro vendedores e usamos HubSpot, mas não conseguimos medir direito quantos viram reunião.";

describe("commercial interpretation providers", () => {
  it("returns the four deterministic synthetic Candidates", async () => {
    const result = await new FakeCommercialInterpretationProvider().interpret(
      syntheticMessage,
    );
    expect(
      result.output.candidates.map(({ factKey, proposedValue }) => ({
        factKey,
        proposedValue,
      })),
    ).toEqual([
      { factKey: "monthly_lead_volume", proposedValue: 800 },
      { factKey: "seller_count", proposedValue: 4 },
      { factKey: "uses_crm", proposedValue: true },
      { factKey: "measures_conversion", proposedValue: false },
    ]);
  });

  it("uses the sealed instruction and restricted Responses API request", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body !== "string")
        throw new TypeError("Expected a JSON request body");
      const body: unknown = JSON.parse(init.body);
      expect(body).toMatchObject({
        model: "gpt-5.6-terra",
        instructions: interpretationInstruction,
        input: syntheticMessage,
        reasoning: { effort: "none" },
        store: false,
        background: false,
        max_output_tokens: 1200,
      });
      expect(body).not.toHaveProperty("tools");
      expect(body).toMatchObject({ text: { format: { strict: true } } });
      return new Response(
        JSON.stringify({
          id: "resp_synthetic",
          model: "gpt-5.6-terra",
          output_text: JSON.stringify({ candidates: [] }),
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    await new OpenAiCommercialInterpretationProvider(
      "test-key",
      fetchMock as typeof fetch,
    ).interpret(syntheticMessage, "correlation");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(interpretationInstructionMetadata.digest).toBe(
      "b90d560563aac84b203ace490efa7ec4b0fa5b7d7ae71e669e6053a49be0b70f",
    );
  });
});
