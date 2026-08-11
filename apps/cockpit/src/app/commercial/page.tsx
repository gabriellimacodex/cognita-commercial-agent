import {
  getDecisionContext,
  getLeadContext,
  getLeadTimeline,
} from "../../lib/commercial-api";
import { runCommercialVerticalSlice } from "./actions";

export const dynamic = "force-dynamic";

interface CommercialPageProperties {
  searchParams: Promise<{
    organizationId?: string;
    leadId?: string;
    error?: string;
  }>;
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
  const humanReviewExercised =
    timeline?.items.some(
      (event) => event.eventType === "commercial_decision_escalated",
    ) ?? false;

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
