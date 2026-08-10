import { getFoundationJob, getServiceHealth } from "../lib/foundation-api";
import { submitFoundationJob } from "./actions";

export const dynamic = "force-dynamic";

interface PageProperties {
  searchParams: Promise<{ jobId?: string; error?: string }>;
}

function requiredUrl(name: string): string {
  const value = process.env[name];
  if (value == null) throw new Error(`${name} is required`);
  return value;
}

export default async function FoundationPage({ searchParams }: PageProperties) {
  const parameters = await searchParams;
  const health = await Promise.all([
    getServiceHealth(`${requiredUrl("API_INTERNAL_URL")}/health`, "api"),
    getServiceHealth(`${requiredUrl("WORKER_INTERNAL_URL")}/health`, "worker"),
    getServiceHealth(
      `${requiredUrl("N8N_INTERNAL_URL")}/healthz/readiness`,
      "n8n",
    ),
  ]);
  const job = parameters.jobId
    ? await getFoundationJob(parameters.jobId).catch(() => undefined)
    : undefined;
  const isTerminal = job?.status === "completed" || job?.status === "failed";

  return (
    <main>
      {!isTerminal && job ? <meta httpEquiv="refresh" content="1" /> : null}
      <header>
        <p className="eyebrow">Cognita Engineering</p>
        <h1>Foundation Cockpit</h1>
        <p>
          Technical proof of PostgreSQL, BullMQ, worker, and persisted result.
        </p>
      </header>

      <section aria-labelledby="services-title">
        <h2 id="services-title">Service status</h2>
        <div className="status-grid">
          {health.map((service) => (
            <article className="status-card" key={service.service}>
              <span
                className={`status-dot ${service.status}`}
                aria-hidden="true"
              />
              <strong>{service.service}</strong>
              <span>{service.status}</span>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="job-title">
        <h2 id="job-title">Technical SHA-256 job</h2>
        <form action={submitFoundationJob}>
          <label htmlFor="input">Technical input</label>
          <textarea
            id="input"
            name="input"
            maxLength={10_000}
            required
            rows={4}
          />
          <button type="submit">Create foundation job</button>
        </form>
        {parameters.error ? <p role="alert">{parameters.error}</p> : null}
      </section>

      {job ? (
        <section aria-labelledby="result-title" data-testid="job-result">
          <h2 id="result-title">Persisted job</h2>
          <dl>
            <dt>ID</dt>
            <dd>{job.id}</dd>
            <dt>Status</dt>
            <dd data-testid="job-status">{job.status}</dd>
            <dt>Publish attempts</dt>
            <dd>{job.publishAttempts}</dd>
            <dt>Process attempts</dt>
            <dd>{job.processAttempts}</dd>
            <dt>Created</dt>
            <dd>{job.createdAt}</dd>
            <dt>Updated</dt>
            <dd>{job.updatedAt}</dd>
            {job.result ? (
              <>
                <dt>Algorithm</dt>
                <dd>{job.result.algorithm}</dd>
                <dt>Digest</dt>
                <dd data-testid="job-digest">{job.result.digest}</dd>
                <dt>Input bytes</dt>
                <dd>{job.result.inputBytes}</dd>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
