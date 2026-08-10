import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("redacts connection strings and authorization headers", () => {
    let output = "";
    const destination = new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    });
    const logger = createLogger(
      { service: "test", environment: "test", version: "test" },
      destination,
    );

    logger.info({
      databaseUrl: "postgresql://user:secret@postgres/database",
      headers: { authorization: "Bearer secret-token" },
    });

    expect(output).not.toContain("secret");
    expect(output).toContain("[REDACTED]");
  });
});
