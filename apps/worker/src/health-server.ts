import Fastify, { type FastifyInstance } from "fastify";

export interface WorkerHealthDependencies {
  checkDatabase(): Promise<void>;
  checkRedis(): Promise<void>;
  isWorkerReady(): boolean;
}

export async function buildWorkerHealthServer(
  dependencies: WorkerHealthDependencies,
): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false,
  });
  server.get("/health", async (_request, reply) => {
    const [database, redis] = await Promise.allSettled([
      dependencies.checkDatabase(),
      dependencies.checkRedis(),
    ]);
    const dependencyState = {
      postgres: database.status === "fulfilled" ? "ok" : "unavailable",
      redis: redis.status === "fulfilled" ? "ok" : "unavailable",
      consumer: dependencies.isWorkerReady() ? "ok" : "unavailable",
    } as const;
    const healthy = Object.values(dependencyState).every(
      (value) => value === "ok",
    );
    await reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      service: "worker",
      dependencies: dependencyState,
    });
  });
  return server;
}
