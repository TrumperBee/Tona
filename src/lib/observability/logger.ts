// GCC - structured server logging with automatic redaction.
//
// Use this instead of console.* in server code. It emits a single JSON line
// (Vercel/Node friendly) with a stable shape and redacts sensitive fields.
import "server-only";

import { randomUUID } from "node:crypto";

import { redactValue } from "./redact";

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  readonly reference?: string;
  readonly route?: string;
  readonly action?: string;
  readonly userId?: string;
  readonly [key: string]: unknown;
}

function emit(level: LogLevel, event: string, context?: LogContext): string {
  const reference = context?.reference ?? randomUUID();
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    reference,
    ...((redactValue(context ?? {}) as Record<string, unknown>) ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
  return reference;
}

export const logger = {
  info(event: string, context?: LogContext): string {
    return emit("info", event, context);
  },
  warn(event: string, context?: LogContext): string {
    return emit("warn", event, context);
  },
  error(event: string, error: unknown, context?: LogContext): string {
    const err =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: String(error) };
    return emit("error", event, { ...context, error: err });
  },
  reference(): string {
    return randomUUID();
  },
};
