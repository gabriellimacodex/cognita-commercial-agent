import type { FastifyReply, FastifyRequest } from "fastify";

export interface HealthDependencies {
  checkDatabase(): Promise<void>;
  checkRedis(): Promise<void>;
}

export class HealthHandler {
  public constructor(private readonly dependencies: HealthDependencies) {}

  public get = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const [database, redis] = await Promise.allSettled([
      this.dependencies.checkDatabase(),
      this.dependencies.checkRedis(),
    ]);
    const dependencies = {
      postgres: database.status === "fulfilled" ? "ok" : "unavailable",
      redis: redis.status === "fulfilled" ? "ok" : "unavailable",
    } as const;
    const healthy =
      dependencies.postgres === "ok" && dependencies.redis === "ok";

    await reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      service: "api",
      dependencies,
    });
  };
}
