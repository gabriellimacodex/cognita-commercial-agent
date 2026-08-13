import type {
  CommercialActionQuestionCandidate,
  CommercialRequirementId,
  QuestionCandidate,
} from "@cognita/schemas";

const questionTemplates: Record<CommercialRequirementId, string> = {
  lead_is_open: "O lead continua aberto?",
  opportunity_does_not_exist: "Já existe uma oportunidade para este lead?",
  contact_has_reachable_channel: "Qual canal permite contatar este lead?",
  facts_are_consistent: "Quais informações conflitantes devem ser corrigidas?",
  company_ownership_type_known: "Qual é o tipo de propriedade da empresa?",
  crm_usage_known: "A empresa utiliza CRM?",
  sales_capacity_known: "Quantos vendedores atuam na operação?",
  recurring_inbound_known: "A empresa recebe demanda inbound recorrente?",
  conversion_measurement_known: "A empresa mede conversão comercial?",
  sales_process_known: "A empresa possui processo comercial definido?",
  commercial_owner_known: "Existe responsável comercial definido?",
  lead_volume_known: "Qual é o volume mensal de leads?",
  average_ticket_known: "Qual é o ticket médio em reais?",
  roi_measurement_known: "É possível comprovar ROI em até 90 dias?",
  pain_confirmed_with_evidence: "A dor comercial foi confirmada com evidência?",
  pain_recurring_with_evidence:
    "A dor comercial é recorrente e possui evidência?",
  pain_measurable_with_evidence:
    "A dor comercial é mensurável e possui evidência?",
  decision_maker_access_known: "Existe acesso ao decisor?",
  budget_known: "O orçamento está confirmado?",
  operational_capacity_known:
    "Existe capacidade operacional para a iniciativa?",
  timing_known: "Qual é o timing atual da iniciativa?",
  nurture_revisit_date_known: "Quando o lead deve ser revisitado?",
  nurture_return_condition_known:
    "Qual condição objetiva permite retomar o lead?",
  human_authority_declared: "Qual autoridade humana decidirá este gate?",
  terminal_reason_from_catalog: "Qual motivo terminal do catálogo se aplica?",
  terminal_evidence_present: "Qual evidência sustenta a decisão terminal?",
  decision_input_is_current: "A decisão ainda representa os Facts atuais?",
  decision_has_not_been_applied: "A decisão ainda não foi aplicada?",
};

function base(requirementId: CommercialRequirementId) {
  return {
    requirementId,
    templateKey: `commercial-question-${requirementId}`,
    templateVersion: "1.0.0" as const,
    text: questionTemplates[requirementId],
  };
}

export function decisionQuestionCandidate(
  requirementId: CommercialRequirementId,
  decisionId: string,
): QuestionCandidate {
  return { ...base(requirementId), decisionId };
}

export function actionQuestionCandidate(
  requirementId: CommercialRequirementId,
  actionCandidateId: string,
  actionPlanId: string,
): CommercialActionQuestionCandidate {
  return {
    ...base(requirementId),
    actionCandidateId,
    actionPlanId,
  };
}
