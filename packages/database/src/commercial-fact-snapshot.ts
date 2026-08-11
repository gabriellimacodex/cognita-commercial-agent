import type { CommercialFact, CommercialFactSnapshot } from "@cognita/schemas";
import type { Kysely, Transaction } from "kysely";

import type { CommercialFactRow, DatabaseSchema } from "./schema.js";

function iso(value: Date): string {
  return value.toISOString();
}

function serializeFact(
  row: CommercialFactRow,
  active: boolean,
  correctedFactIds: string[],
): CommercialFact {
  return {
    id: row.id,
    organizationId: row.organizationId,
    leadId: row.leadId,
    factKey: row.factKey,
    factSchemaVersion: row.factSchemaVersion,
    valueType: row.valueType,
    value: row.value as CommercialFact["value"],
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    declarerRef: row.declarerRef,
    authorityType: row.authorityType,
    authorityRef: row.authorityRef,
    executorRef: row.executorRef,
    evidence:
      row.evidenceType == null || row.evidenceRef == null
        ? null
        : { type: row.evidenceType, ref: row.evidenceRef },
    observedAt: iso(row.observedAt),
    recordedAt: iso(row.recordedAt),
    active,
    correctedFactIds,
  };
}

export async function buildCommercialFactSnapshots(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  organizationId: string,
  leadId: string,
): Promise<CommercialFactSnapshot[]> {
  const [facts, corrections] = await Promise.all([
    executor
      .selectFrom("commercialFacts")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("leadId", "=", leadId)
      .orderBy("recordedAt")
      .orderBy("id")
      .execute(),
    executor
      .selectFrom("commercialFactCorrections")
      .innerJoin(
        "commercialFacts",
        "commercialFacts.id",
        "commercialFactCorrections.correctiveFactId",
      )
      .select([
        "commercialFactCorrections.correctiveFactId as correctiveFactId",
        "commercialFactCorrections.correctedFactId as correctedFactId",
      ])
      .where("commercialFactCorrections.organizationId", "=", organizationId)
      .where("commercialFacts.leadId", "=", leadId)
      .execute(),
  ]);
  const corrected = new Set(corrections.map((item) => item.correctedFactId));
  const correctedBy = new Map<string, string[]>();
  for (const correction of corrections) {
    const values = correctedBy.get(correction.correctiveFactId) ?? [];
    values.push(correction.correctedFactId);
    correctedBy.set(correction.correctiveFactId, values);
  }
  const serialized = facts.map((fact) =>
    serializeFact(
      fact,
      !corrected.has(fact.id),
      (correctedBy.get(fact.id) ?? []).sort(),
    ),
  );
  const groups = new Map<string, CommercialFact[]>();
  for (const fact of serialized.filter((item) => item.active)) {
    const key = `${fact.factKey}:${fact.factSchemaVersion}`;
    const values = groups.get(key) ?? [];
    values.push(fact);
    groups.set(key, values);
  }
  const allKeys = new Set(
    serialized.map((fact) => `${fact.factKey}:${fact.factSchemaVersion}`),
  );
  return [...allKeys].sort().map((key) => {
    const active = groups.get(key) ?? [];
    const first = serialized.find(
      (fact) => `${fact.factKey}:${fact.factSchemaVersion}` === key,
    )!;
    const semanticValues = new Set(
      active.map((fact) => JSON.stringify(fact.value)),
    );
    return {
      factKey: first.factKey,
      factSchemaVersion: first.factSchemaVersion,
      status:
        active.length === 0
          ? "unknown"
          : semanticValues.size === 1
            ? "consistent"
            : "conflicting",
      value:
        active.length > 0 && semanticValues.size === 1
          ? (active[0]?.value ?? null)
          : null,
      facts: active,
    } satisfies CommercialFactSnapshot;
  });
}
