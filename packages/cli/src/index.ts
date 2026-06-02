#!/usr/bin/env node
import { Command } from "commander";
import {
  AgentPassportError,
  AuthenticationError,
  DomainNotReadyError,
  InsufficientBalanceError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  TransportError,
  UpstreamError,
  ValidationError,
} from "@agentpassportsh/sdk";
import { registerLogin } from "./commands/login.js";
import { registerConfig } from "./commands/config.js";
import { registerDomain } from "./commands/domain.js";
import { registerEmail } from "./commands/email.js";
import { registerProxy } from "./commands/proxy.js";

const program = new Command();

program
  .name("agentpassport")
  .description(
    "Inboxes and country-anchored IPs for your AI agent — one CLI command at a time.",
  )
  .version("0.2.0");

registerLogin(program);
registerConfig(program);
registerDomain(program);
registerEmail(program);
registerProxy(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const { code, message } = mapError(err);
  process.stderr.write(`\x1b[31m✗\x1b[0m ${message}\n`);
  process.exit(code);
});

/**
 * Exit-code mapping:
 *   0 = success (never returned here)
 *   1 = user error (bad input, not found, validation, domain not ready)
 *   2 = system error (transport, upstream, timeout, unknown)
 *   3 = insufficient balance
 */
function mapError(err: unknown): { code: number; message: string } {
  if (err instanceof InsufficientBalanceError) {
    return { code: 3, message: `Insufficient balance: ${err.message}` };
  }
  if (
    err instanceof ValidationError ||
    err instanceof NotFoundError ||
    err instanceof DomainNotReadyError ||
    err instanceof AuthenticationError
  ) {
    return { code: 1, message: err.message };
  }
  if (err instanceof RateLimitError) {
    return { code: 2, message: `Rate limited. Retry after ${err.retryAfterSeconds}s.` };
  }
  if (
    err instanceof TimeoutError ||
    err instanceof TransportError ||
    err instanceof UpstreamError ||
    err instanceof AgentPassportError
  ) {
    return { code: 2, message: err.message };
  }
  if (err instanceof Error) return { code: 2, message: err.message };
  return { code: 2, message: String(err) };
}
