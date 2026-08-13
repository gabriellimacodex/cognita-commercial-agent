import type { FastifyInstance } from "fastify";

import type { CommercialHandler } from "./commercial-handler.js";

export function registerCommercialRoutes(
  api: FastifyInstance,
  handler: CommercialHandler,
): void {
  api.post("/commercial/organizations", handler.createOrganization);
  api.get("/commercial/organizations/:id", handler.getOrganization);
  api.post("/commercial/companies", handler.createCompany);
  api.get("/commercial/companies/:id", handler.getCompany);
  api.post("/commercial/contacts", handler.createContact);
  api.get("/commercial/contacts/:id", handler.getContact);
  api.put("/commercial/contacts/:id/company", handler.linkContactCompany);
  api.post("/commercial/leads", handler.createLead);
  api.get("/commercial/leads/:id", handler.getLead);
  api.put("/commercial/leads/:id/company", handler.linkLeadCompany);
  api.post("/commercial/leads/:id/assignments", handler.assignLead);
  api.get("/commercial/leads/:id/context", handler.getLeadContext);
  api.get("/commercial/leads/:id/timeline", handler.getLeadTimeline);
  api.post("/commercial/leads/:id/facts", handler.recordFact);
  api.get("/commercial/leads/:id/facts", handler.listFacts);
  api.post("/commercial/leads/:id/decisions", handler.evaluateDecision);
  api.post("/commercial/leads/:id/action-plans", handler.planAction);
  api.get("/commercial/action-plans/:id", handler.getActionPlan);
  api.post(
    "/commercial/action-candidates/:id/decisions",
    handler.evaluateActionCandidate,
  );
  api.post(
    "/commercial/action-candidates/:id/applications",
    handler.applyActionCandidate,
  );
  api.get("/commercial/leads/:id/decision-context", handler.getDecisionContext);
  api.get("/commercial/decisions/:id", handler.getDecision);
  api.post("/commercial/conversations", handler.createConversation);
  api.get("/commercial/conversations/:id", handler.getConversation);
  api.post("/commercial/conversations/:id/messages", handler.createMessage);
  api.post("/commercial/opportunities", handler.createOpportunity);
  api.get("/commercial/opportunities/:id", handler.getOpportunity);
  api.post(
    "/commercial/opportunities/:id/transitions",
    handler.transitionOpportunity,
  );
}

export function registerCommercialInterpretationRoutes(
  api: FastifyInstance,
  handler: CommercialHandler,
): void {
  api.get(
    "/commercial/leads/:id/question-candidates",
    handler.listQuestionCandidates,
  );
  api.post(
    "/commercial/messages/:id/interpretations",
    handler.startInterpretation,
  );
  api.get(
    "/commercial/messages/:id/interpretations",
    handler.listInterpretations,
  );
  api.get("/commercial/interpretations/:id", handler.getInterpretation);
  api.post("/commercial/fact-candidates/:id/confirm", handler.confirmCandidate);
  api.post("/commercial/fact-candidates/:id/reject", handler.rejectCandidate);
}
