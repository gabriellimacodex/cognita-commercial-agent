import type { FoundationJobRow } from "@cognita/database";
import type { Logger } from "@cognita/observability";

export interface RecoveryJobStore {
  claimRecoverableJobs(
    limit: number,
    claimMs: number,
  ): Promise<Array<Pick<FoundationJobRow, "id">>>;
}

export interface RecoveryPublisher {
  publish(jobId: string, correlationId: string): Promise<void>;
}

export interface RecoveryOptions {
  batchSize: number;
  claimMs: number;
}

export class FoundationJobRecovery {
  private interval: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  public constructor(
    private readonly repository: RecoveryJobStore,
    private readonly publisher: RecoveryPublisher,
    private readonly options: RecoveryOptions,
    private readonly logger?: Pick<Logger, "info" | "error">,
  ) {}

  public async runOnce(): Promise<void> {
    const jobs = await this.repository.claimRecoverableJobs(
      this.options.batchSize,
      this.options.claimMs,
    );
    for (const job of jobs) {
      await this.publisher.publish(job.id, `recovery:${job.id}`);
    }
    if (jobs.length > 0) {
      this.logger?.info({
        event: "job_recovery_completed",
        recoveredCount: jobs.length,
      });
    }
  }

  public start(intervalMs: number): void {
    if (this.interval != null) return;
    this.interval = setInterval(() => {
      if (this.inFlight != null) return;
      this.inFlight = this.runOnce()
        .catch((error: unknown) => {
          this.logger?.error({ event: "job_recovery_failed", err: error });
        })
        .finally(() => {
          this.inFlight = undefined;
        });
    }, intervalMs);
    this.interval.unref();
  }

  public async stop(): Promise<void> {
    if (this.interval != null) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    await this.inFlight;
  }
}
