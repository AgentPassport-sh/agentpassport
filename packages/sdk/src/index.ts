// Public surface of @agentpassportsh/sdk.

export { AgentPassport } from "./client.js";
export type { AgentPassportOptions } from "./client.js";

export type {
  CreateInboxOptions,
  SendEmailOptions,
  ReadInboundOptions,
  WatchOptions,
} from "./options.js";

// Typed error hierarchy — every SDK method throws one of these.
export {
  AgentPassportError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  InsufficientBalanceError,
  DomainNotReadyError,
  TimeoutError,
  TransportError,
  UpstreamError,
} from "./errors.js";

// Wire-shape data types, re-exported so consumers can import everything
// from a single package.
export type {
  Country,
  City,
  ISO8601,
  OutputFormat,
  ProxySession,
  VpnConnection,
  DomainRecord,
  DomainStatus,
  Domain,
  Inbox,
  InboundEmail,
  WalletBalance,
} from "@agentpassportsh/types";
