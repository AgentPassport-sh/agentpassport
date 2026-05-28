// Typed error hierarchy returned by the SDK. The CLI maps these to exit codes.
//
// Backend returns errors as a uniform JSON envelope:
//   { "error": { "type": "rate_limit", "message": "…", "retry_after_seconds": 30 } }
// The SDK's HTTP client switches on `type` and throws the right subclass.

export class AgentPassportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentPassportError";
  }
}

export class AuthenticationError extends AgentPassportError {
  constructor(message = "API key missing or invalid") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends AgentPassportError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AgentPassportError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AgentPassportError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number, message = "Rate limited") {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class InsufficientBalanceError extends AgentPassportError {
  constructor(message = "Insufficient balance") {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

/**
 * The customer's domain isn't ready for the operation that was attempted —
 * usually because nameserver delegation hasn't propagated yet, or because
 * the email DNS preset hasn't been verified.
 */
export class DomainNotReadyError extends AgentPassportError {
  readonly domain: string;
  constructor(domain: string, message?: string) {
    super(message ?? `Domain ${domain} is not ready yet.`);
    this.name = "DomainNotReadyError";
    this.domain = domain;
  }
}

/**
 * Thrown by SDK-side wait loops (watch / waitForOtp / waitActive) when they
 * exceed their configured timeout without seeing the awaited event.
 */
export class TimeoutError extends AgentPassportError {
  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/** Network-layer failure: connection refused, DNS, TLS, etc. */
export class TransportError extends AgentPassportError {
  constructor(message: string) {
    super(message);
    this.name = "TransportError";
  }
}

/**
 * The backend reported a failure mode that we couldn't normalize into one of
 * the typed errors above — typically an unexpected 5xx or a vendor we don't
 * have a mapping for. Surface message verbatim; the user will see it.
 */
export class UpstreamError extends AgentPassportError {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}
