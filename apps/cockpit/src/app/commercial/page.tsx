import {
  getCommercialDecision,
  getCommercialActionPlan,
  getDecisionContext,
  getCommercialInterpretation,
  getQuestionCandidates,
  getLeadContext,
  getLeadTimeline,
} from "../../lib/commercial-api";
import {
  evaluateIntelligenceDecision,
  applyPlannedCommercialAction,
  interpretSelectedCommercialMessage,
  prepareCommercialIntelligenceMessage,
  prepareCommercialActionPlan,
  resolveIntelligenceCandidate,
  runCommercialVerticalSlice,
  submitCommercialActionCandidate,
} from "./actions";

export const dynamic = "force-dynamic";

interface CommercialPageProperties {
  searchParams: Promise<{
    organizationId?: string;
    leadId?: string;
    error?: string;
    runId?: string;
    messageId?: string;
    baselineDecisionId?: string;
    actionPlanId?: string;
    applicationTargetId?: string;
  }>;
}

function evidenceText(message: string, start: number, end: number): string {
  return Array.from(message).slice(start, end).join("");
}

export default async function CommercialPage({
  searchParams,
}: CommercialPageProperties) {
  const parameters = await searchParams;
  const persisted =
    parameters.organizationId != null && parameters.leadId != null
      ? await Promise.all([
          getLeadContext(parameters.organizationId, parameters.leadId),
          getLeadTimeline(parameters.organizationId, parameters.leadId),
          getDecisionContext(parameters.organizationId, parameters.leadId),
        ]).catch(() => undefined)
      : undefined;
  const context = persisted?.[0];
  const timeline = persisted?.[1];
  const decisionContext = persisted?.[2];
  const selectedMessage = context?.conversations
    .flatMap((conversation) => conversation.messages)
    .find((message) => message.id === parameters.messageId);
  const humanReviewExercised =
    decisionContext?.latestDecision?.authorityType === "declared_human";
  const interpretation =
    parameters.organizationId != null && parameters.runId != null
      ? await getCommercialInterpretation(
          parameters.organizationId,
          parameters.runId,
        ).catch(() => undefined)
      : undefined;
  const questions =
    parameters.organizationId != null && parameters.leadId != null
      ? await getQuestionCandidates(
          parameters.organizationId,
          parameters.leadId,
        ).catch(() => [])
      : [];
  const baselineDecision =
    parameters.organizationId != null && parameters.baselineDecisionId != null
      ? await getCommercialDecision(
          parameters.organizationId,
          parameters.baselineDecisionId,
        ).catch(() => undefined)
      : undefined;
  const actionPlan =
    parameters.organizationId != null && parameters.actionPlanId != null
      ? await getCommercialActionPlan(
          parameters.organizationId,
          parameters.actionPlanId,
        ).catch(() => undefined)
      : undefined;
  const actionDecision =
    parameters.organizationId != null && actionPlan?.decisionId != null
      ? await getCommercialDecision(
          parameters.organizationId,
          actionPlan.decisionId,
        ).catch(() => undefined)
      : undefined;

  return (
    <main>
      <header>
        <p className="eyebrow">Cognita Commercial Domain</p>
        <h1>Commercial foundation proof</h1>
        <p>
          Synchronous, deterministic vertical slice persisted in PostgreSQL.
        </p>
        <a href="/">Return to foundation cockpit</a>
      </header>

      <section aria-labelledby="commercial-form-title">
        <h2 id="commercial-form-title">Run complete vertical slice</h2>
        <form action={runCommercialVerticalSlice}>
          <div className="field-grid">
            <label>
              Organization
              <input
                name="organizationName"
                defaultValue="Cognita Local"
                required
              />
            </label>
            <label>
              Company
              <input
                name="companyName"
                defaultValue="Example Company"
                required
              />
            </label>
            <label>
              Company domain
              <input
                name="companyDomain"
                defaultValue="example.test"
                required
              />
            </label>
            <label>
              Contact
              <input
                name="contactName"
                defaultValue="Example Contact"
                required
              />
            </label>
            <label>
              Contact e-mail
              <input
                name="contactEmail"
                type="email"
                defaultValue="contact@example.test"
                required
              />
            </label>
            <label>
              Lead source
              <input name="leadSource" defaultValue="cockpit" required />
            </label>
            <label>
              Responsible human reference
              <input name="assigneeRef" defaultValue="local-founder" required />
            </label>
            <label>
              Descriptive channel
              <input name="channel" defaultValue="web-form" required />
            </label>
            <label>
              Conversion measurement
              <select name="measuresConversion" defaultValue="true" required>
                <option value="true">Measured (standard fit)</option>
                <option value="false">Not measured (human review)</option>
              </select>
            </label>
          </div>
          <label htmlFor="messageBody">Inbound text message</label>
          <textarea
            id="messageBody"
            name="messageBody"
            defaultValue="Synthetic local commercial inquiry"
            maxLength={10_000}
            required
            rows={3}
          />
          <button type="submit">Create commercial proof</button>
        </form>
        {parameters.error ? <p role="alert">{parameters.error}</p> : null}
      </section>

      <section aria-labelledby="intelligence-form-title">
        <h2 id="intelligence-form-title">Run synthetic intelligence slice</h2>
        <p>
          Creates a synthetic Message, persists a run and four non-authoritative
          Candidates for explicit human review.
        </p>
        <form action={prepareCommercialIntelligenceMessage}>
          <label>
            Synthetic inbound Message
            <textarea
              name="intelligenceMessage"
              rows={4}
              required
              defaultValue="Hoje entram uns 800 leads por mês, temos quatro vendedores e usamos HubSpot, mas não conseguimos medir direito quantos viram reunião."
            />
          </label>
          <button type="submit">Create synthetic Message</button>
        </form>
      </section>

      <section aria-labelledby="action-planning-title">
        <h2 id="action-planning-title">Commercial Action Planning</h2>
        <p>
          Create an explicit deterministic Plan. Candidate, Decision and
          application remain separate human-controlled steps.
        </p>
        <form action={prepareCommercialActionPlan}>
          <label>
            Synthetic scenario
            <select name="planningScenario" defaultValue="material" required>
              <option value="material">Material action ready</option>
              <option value="review">Human review required</option>
              <option value="missing">Missing requirement</option>
            </select>
          </label>
          <button type="submit">Create Action Plan</button>
        </form>
      </section>

      {actionPlan != null ? (
        <section
          data-testid="commercial-action-plan"
          aria-labelledby="action-plan-result-title"
        >
          <h2 id="action-plan-result-title">Persisted Action Plan</h2>
          <dl>
            <dt>Plan</dt>
            <dd>{actionPlan.id}</dd>
            <dt>Objective</dt>
            <dd data-testid="action-plan-objective">
              {actionPlan.objective.key}@{actionPlan.objective.version}
            </dd>
            <dt>Planner</dt>
            <dd>
              {actionPlan.planner.key}@{actionPlan.planner.version}
            </dd>
            <dt>Currentness</dt>
            <dd data-testid="action-plan-currentness">
              {actionPlan.currentness}
            </dd>
            <dt>Result</dt>
            <dd>{actionPlan.resultType}</dd>
          </dl>
          <p>Rationale: {actionPlan.rationaleCodes.join(", ")}</p>
          {actionPlan.candidate != null ? (
            <div data-testid="commercial-action-candidate">
              <h3>Non-authoritative Candidate</h3>
              <p>
                {actionPlan.candidate.candidateType} ·{" "}
                {actionPlan.candidate.requestedAction}
              </p>
              <p>{actionPlan.candidate.requiredCapabilityKey}</p>
              {actionPlan.questionCandidate != null ? (
                <p data-testid="action-question-candidate">
                  {actionPlan.questionCandidate.requirementId}:{" "}
                  {actionPlan.questionCandidate.text}
                </p>
              ) : null}
              {actionPlan.decisionId == null &&
              actionPlan.currentness === "current" &&
              [
                "review_commercial_exception_v1",
                "submit_commercial_decision_v1",
              ].includes(actionPlan.candidate.requiredCapabilityKey) ? (
                <form action={submitCommercialActionCandidate}>
                  <input
                    type="hidden"
                    name="organizationId"
                    value={parameters.organizationId}
                  />
                  <input
                    type="hidden"
                    name="leadId"
                    value={parameters.leadId}
                  />
                  <input
                    type="hidden"
                    name="actionPlanId"
                    value={actionPlan.id}
                  />
                  <input
                    type="hidden"
                    name="candidateId"
                    value={actionPlan.candidate.id}
                  />
                  <input
                    type="hidden"
                    name="requestedAction"
                    value={actionPlan.candidate.requestedAction}
                  />
                  <input
                    type="hidden"
                    name="requiredCapabilityKey"
                    value={actionPlan.candidate.requiredCapabilityKey}
                  />
                  <input
                    type="hidden"
                    name="reasonCode"
                    value={
                      actionPlan.candidate.decisionReasonCodes.find(
                        (code) => code !== "human_authority_required",
                      ) ?? ""
                    }
                  />
                  <button type="submit">
                    Submit Candidate to Decision Engine
                  </button>
                </form>
              ) : null}
              {actionDecision?.outcome === "allow" ? (
                <form action={applyPlannedCommercialAction}>
                  <input
                    type="hidden"
                    name="organizationId"
                    value={parameters.organizationId}
                  />
                  <input
                    type="hidden"
                    name="leadId"
                    value={parameters.leadId}
                  />
                  <input
                    type="hidden"
                    name="actionPlanId"
                    value={actionPlan.id}
                  />
                  <input
                    type="hidden"
                    name="candidateId"
                    value={actionPlan.candidate.id}
                  />
                  <button type="submit">Apply allowed Decision</button>
                </form>
              ) : null}
            </div>
          ) : null}
          {actionDecision != null ? (
            <p data-testid="action-decision-outcome">
              Decision: {actionDecision.outcome}
            </p>
          ) : null}
          {parameters.applicationTargetId != null ? (
            <p data-testid="action-application-receipt">
              Applied target: {parameters.applicationTargetId}
            </p>
          ) : null}
        </section>
      ) : null}

      {selectedMessage != null && interpretation == null ? (
        <section
          data-testid="selected-commercial-message"
          aria-labelledby="selected-message-title"
        >
          <h2 id="selected-message-title">Selected Message</h2>
          <p>{selectedMessage.body}</p>
          <code>{selectedMessage.id}</code>
          <form action={interpretSelectedCommercialMessage}>
            <input
              type="hidden"
              name="organizationId"
              value={parameters.organizationId}
            />
            <input type="hidden" name="leadId" value={parameters.leadId} />
            <input type="hidden" name="messageId" value={selectedMessage.id} />
            <button type="submit">Interpret selected Message</button>
          </form>
        </section>
      ) : null}

      {interpretation ? (
        <section
          data-testid="commercial-interpretation"
          aria-labelledby="interpretation-title"
        >
          <h2 id="interpretation-title">Interpretation and Candidate review</h2>
          <dl>
            <dt>Run</dt>
            <dd>{interpretation.id}</dd>
            <dt>Status</dt>
            <dd data-testid="interpretation-status">{interpretation.status}</dd>
            <dt>Provider baseline</dt>
            <dd>
              {interpretation.providerId}/{interpretation.modelId}
            </dd>
            <dt>Instruction</dt>
            <dd>
              {interpretation.instructionKey}@
              {interpretation.instructionVersion} ·{" "}
              {interpretation.instructionDigest}
            </dd>
          </dl>
          <ol className="timeline">
            {interpretation.candidates.map((candidate) => {
              const activeFactIds =
                decisionContext?.facts
                  .find((snapshot) => snapshot.factKey === candidate.factKey)
                  ?.facts.map((fact) => fact.id) ?? [];
              return (
                <li key={candidate.id} data-testid="fact-candidate">
                  <strong>
                    {candidate.factKey}: {String(candidate.proposedValue)}
                  </strong>
                  <span>{candidate.status}</span>
                  {candidate.evidence ? (
                    <code>
                      Evidence [{candidate.evidence.startOffset},{" "}
                      {candidate.evidence.endOffset}) ·{" "}
                      {candidate.evidence.spanDigest}
                    </code>
                  ) : null}
                  {candidate.evidence != null && selectedMessage != null ? (
                    <p>
                      Evidence:{" "}
                      <mark data-testid="evidence-highlight">
                        {evidenceText(
                          selectedMessage.body,
                          candidate.evidence.startOffset,
                          candidate.evidence.endOffset,
                        )}
                      </mark>
                    </p>
                  ) : null}
                  {candidate.status === "pending_confirmation" ? (
                    <form
                      action={resolveIntelligenceCandidate}
                      className="inline-actions"
                    >
                      <input
                        type="hidden"
                        name="organizationId"
                        value={parameters.organizationId}
                      />
                      <input
                        type="hidden"
                        name="leadId"
                        value={parameters.leadId}
                      />
                      <input
                        type="hidden"
                        name="messageId"
                        value={parameters.messageId}
                      />
                      <input
                        type="hidden"
                        name="runId"
                        value={interpretation.id}
                      />
                      <input
                        type="hidden"
                        name="candidateId"
                        value={candidate.id}
                      />
                      <input
                        type="hidden"
                        name="baselineDecisionId"
                        value={parameters.baselineDecisionId}
                      />
                      <label>
                        Confirmation mode
                        <select name="confirmationMode" defaultValue="assert">
                          <option value="assert">Assert</option>
                          <option
                            value="correct"
                            disabled={activeFactIds.length === 0}
                          >
                            Correct complete active set
                          </option>
                        </select>
                      </label>
                      {activeFactIds.map((factId) => (
                        <label key={factId}>
                          <input
                            type="checkbox"
                            name="correctsFactIds"
                            value={factId}
                          />
                          Correct Fact {factId}
                        </label>
                      ))}
                      <button type="submit" name="resolution" value="confirm">
                        Confirm as Fact
                      </button>
                      <button type="submit" name="resolution" value="reject">
                        Reject
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <form action={evaluateIntelligenceDecision}>
            <input
              type="hidden"
              name="organizationId"
              value={parameters.organizationId}
            />
            <input type="hidden" name="leadId" value={parameters.leadId} />
            <input
              type="hidden"
              name="messageId"
              value={parameters.messageId}
            />
            <input type="hidden" name="runId" value={interpretation.id} />
            <input
              type="hidden"
              name="baselineDecisionId"
              value={parameters.baselineDecisionId}
            />
            <button type="submit">Evaluate reviewed Decision context</button>
          </form>
        </section>
      ) : null}

      {baselineDecision != null ? (
        <section
          data-testid="missing-requirements-comparison"
          aria-labelledby="missing-comparison-title"
        >
          <h2 id="missing-comparison-title">Missing requirements comparison</h2>
          <p>
            Before review:{" "}
            <span data-testid="missing-before">
              {baselineDecision.missingRequirements.join(", ") || "none"}
            </span>
          </p>
          <p>
            Current Decision:{" "}
            <span data-testid="missing-after">
              {decisionContext?.latestDecision?.missingRequirements.join(
                ", ",
              ) || "none"}
            </span>
          </p>
        </section>
      ) : null}

      {questions.length > 0 ? (
        <section
          data-testid="question-candidates"
          aria-labelledby="questions-title"
        >
          <h2 id="questions-title">Deterministic Question Candidates</h2>
          <ul>
            {questions.map((question) => (
              <li key={question.requirementId}>
                {question.text} <code>{question.requirementId}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {context ? (
        <>
          <section
            data-testid="commercial-context"
            aria-labelledby="context-title"
          >
            <h2 id="context-title">Persisted Lead context</h2>
            <dl>
              <dt>Organization</dt>
              <dd>{context.lead.organizationId}</dd>
              <dt>Company</dt>
              <dd>{context.company?.name ?? "not linked"}</dd>
              <dt>Contact</dt>
              <dd>{context.contact.name}</dd>
              <dt>Lead</dt>
              <dd data-testid="commercial-lead-id">{context.lead.id}</dd>
              <dt>Lead status</dt>
              <dd>{context.lead.status}</dd>
              <dt>Responsible</dt>
              <dd>{context.assignment?.assigneeRef ?? "unassigned"}</dd>
              <dt>Opportunity</dt>
              <dd>{context.opportunity?.id ?? "not created"}</dd>
              <dt>Commercial state</dt>
              <dd data-testid="commercial-state">
                {context.opportunity?.commercialState ?? "not created"}
              </dd>
              <dt>Conversation</dt>
              <dd>
                {context.conversations[0]?.conversation.id ?? "not created"}
              </dd>
              <dt>Inbound message</dt>
              <dd>
                {context.conversations[0]?.messages[0]?.body ?? "not recorded"}
              </dd>
            </dl>
          </section>

          <section
            data-testid="commercial-timeline"
            aria-labelledby="timeline-title"
          >
            <h2 id="timeline-title">Append-only timeline</h2>
            <ol className="timeline">
              {timeline?.items.map((event) => (
                <li key={event.id}>
                  <strong>{event.eventType}</strong>
                  <span>{event.recordedAt}</span>
                  <code>{event.id}</code>
                </li>
              ))}
            </ol>
          </section>

          <section
            data-testid="commercial-decision-context"
            aria-labelledby="decision-title"
          >
            <h2 id="decision-title">Decision context</h2>
            <dl>
              <dt>Active Fact keys</dt>
              <dd data-testid="commercial-active-facts">
                {decisionContext?.facts.length ?? 0}
              </dd>
              <dt>Latest Decision</dt>
              <dd data-testid="commercial-decision-id">
                {decisionContext?.latestDecision?.id ?? "not evaluated"}
              </dd>
              <dt>Requested action</dt>
              <dd>
                {decisionContext?.latestDecision?.requestedAction ?? "none"}
              </dd>
              <dt>Outcome</dt>
              <dd data-testid="commercial-decision-outcome">
                {decisionContext?.latestDecision?.outcome ?? "none"}
              </dd>
              <dt>Human review exercised</dt>
              <dd data-testid="commercial-human-review">
                {humanReviewExercised ? "yes" : "no"}
              </dd>
              <dt>Policy</dt>
              <dd>
                {decisionContext?.latestDecision == null
                  ? "none"
                  : `${decisionContext.latestDecision.policyKey}@${decisionContext.latestDecision.policyVersion}`}
              </dd>
            </dl>
          </section>
        </>
      ) : null}
    </main>
  );
}
