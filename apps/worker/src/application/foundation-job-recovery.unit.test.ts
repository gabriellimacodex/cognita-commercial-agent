import { describe, expect, it, vi } from "vitest";

import { FoundationJobRecovery } from "./foundation-job-recovery.js";

describe("FoundationJobRecovery", () => {
  it("re-publishes jobs claimed from PostgreSQL", async () => {
    const repository = {
      claimRecoverableJobs: vi.fn(async () => [
        { id: "5f360f2e-896c-42b3-81ad-3a691269c031" },
      ]),
    };
    const publisher = { publish: vi.fn(async () => undefined) };
    const recovery = new FoundationJobRecovery(repository, publisher, {
      batchSize: 10,
      claimMs: 1_000,
    });

    await recovery.runOnce();

    expect(publisher.publish).toHaveBeenCalledWith(
      "5f360f2e-896c-42b3-81ad-3a691269c031",
      "recovery:5f360f2e-896c-42b3-81ad-3a691269c031",
    );
  });

  it("waits for an in-flight recovery pass during shutdown", async () => {
    let releaseClaim: (() => void) | undefined;
    const claim = new Promise<Array<{ id: string }>>((resolve) => {
      releaseClaim = () => resolve([]);
    });
    const repository = {
      claimRecoverableJobs: vi.fn(async () => claim),
    };
    const publisher = { publish: vi.fn(async () => undefined) };
    const recovery = new FoundationJobRecovery(repository, publisher, {
      batchSize: 10,
      claimMs: 1_000,
    });

    recovery.start(1);
    await vi.waitFor(() => {
      expect(repository.claimRecoverableJobs).toHaveBeenCalledOnce();
    });
    const stopped = vi.fn();
    const stopPromise = recovery.stop().then(stopped);

    await Promise.resolve();
    expect(stopped).not.toHaveBeenCalled();
    releaseClaim?.();
    await stopPromise;

    expect(stopped).toHaveBeenCalledOnce();
  });
});
