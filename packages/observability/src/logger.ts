import pino, { type DestinationStream, type Logger } from "pino";

export interface LoggerContext {
  service: string;
  environment: string;
  version: string;
}

const redactPaths = [
  "databaseUrl",
  "redisUrl",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];

export function createLogger(
  context: LoggerContext,
  destination?: DestinationStream,
): Logger {
  return pino(
    {
      base: context,
      level: process.env.LOG_LEVEL ?? "info",
      messageKey: "message",
      redact: { paths: redactPaths, censor: "[REDACTED]" },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}
