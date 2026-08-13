import { createHash } from "node:crypto";

export type EvidenceAlignment =
  | {
      valid: true;
      startOffset: number;
      endOffset: number;
      spanDigest: string;
    }
  | {
      valid: false;
      validationCode:
        | "evidence_quote_empty"
        | "evidence_quote_not_found"
        | "evidence_quote_multiple_matches"
        | "evidence_quote_round_trip_mismatch";
    };

export function alignEvidenceQuote(
  message: string,
  evidenceQuote: string,
): EvidenceAlignment {
  const messageCodePoints = Array.from(message);
  const quoteCodePoints = Array.from(evidenceQuote);
  if (quoteCodePoints.length === 0) {
    return { valid: false, validationCode: "evidence_quote_empty" };
  }

  const matches: number[] = [];
  for (
    let start = 0;
    start <= messageCodePoints.length - quoteCodePoints.length;
    start += 1
  ) {
    if (
      quoteCodePoints.every(
        (codePoint, index) => messageCodePoints[start + index] === codePoint,
      )
    ) {
      matches.push(start);
    }
  }
  if (matches.length === 0) {
    return { valid: false, validationCode: "evidence_quote_not_found" };
  }
  if (matches.length > 1) {
    return {
      valid: false,
      validationCode: "evidence_quote_multiple_matches",
    };
  }

  const startOffset = matches[0]!;
  const endOffset = startOffset + quoteCodePoints.length;
  const extracted = messageCodePoints.slice(startOffset, endOffset).join("");
  if (extracted !== evidenceQuote) {
    return {
      valid: false,
      validationCode: "evidence_quote_round_trip_mismatch",
    };
  }
  return {
    valid: true,
    startOffset,
    endOffset,
    spanDigest: createHash("sha256").update(extracted).digest("hex"),
  };
}
