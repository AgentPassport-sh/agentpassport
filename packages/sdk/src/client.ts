// HTTP client + AgentPassport facade.
//
// This is the high-level surface SDK consumers (and our own CLI) import.
// It speaks to the AgentPassport backend over HTTPS using a Bearer API
// key. Every public method maps to a documented backend endpoint.

import type {
  Domain,
  Inbox,
  InboundEmail,
  WalletBalance,
} from "@agentpassportsh/types";
import type { SendEmailOptions, WatchOptions, ReadInboundOptions, CreateInboxOptions } from "./options.js";
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
} from "./errors.js";

const PROD_BASE_URL = "https://api.agentpassport.sh";
const TEST_BASE_URL = "https://dev.api.agentpassport.sh";

/**
 * Stripe-style environment routing. The API key's prefix is the source
 * of truth for which backend to hit:
 *
 *   ap_live_*  →  PROD_BASE_URL   (production)
 *   ap_test_*  →  TEST_BASE_URL   (dev / test)
 *   anything else → PROD_BASE_URL (safe default; covers malformed keys)
 *
 * An explicit `baseUrl` option always wins — that's the escape hatch for
 * local development (`http://localhost:4000`) and for unusual deployments.
 * The CLI wires `AP_BASE_URL` env var into this same option.
 *
 * The whole point: one published CLI package, install it from npm exactly
 * once, the key alone decides whether you hit dev or prod. Internal
 * testers get an `ap_test_*` key and need zero extra configuration.
 */
function resolveBaseUrl(apiKey: string, override: string | undefined): string {
  if (override) return override;
  if (apiKey.startsWith("ap_test_")) return TEST_BASE_URL;
  return PROD_BASE_URL;
}

export interface AgentPassportOptions {
  apiKey: string;
  /**
   * Explicit backend override. Wins over the `ap_test_`/`ap_live_` prefix
   * routing. Use for local development (`http://localhost:4000`) and
   * non-standard deployments only.
   */
  baseUrl?: string;
  /** Override fetch; useful for testing. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

interface BackendErrorEnvelope {
  error: {
    type: string;
    message: string;
    retry_after_seconds?: number;
    domain?: string;
    status?: number;
  };
}

export class AgentPassport {
  readonly domains: DomainsResource;
  readonly email: EmailResource;
  readonly wallet: WalletResource;

  private readonly http: HttpClient;

  constructor(options: AgentPassportOptions) {
    if (!options.apiKey) {
      throw new AuthenticationError("apiKey is required");
    }
    this.http = new HttpClient(options);
    this.domains = new DomainsResource(this.http);
    this.email = new EmailResource(this.http);
    this.wallet = new WalletResource(this.http);
  }
}

// ─── HTTP client (internal) ────────────────────────────────────────────────

class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AgentPassportOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = resolveBaseUrl(options.apiKey, options.baseUrl).replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? (globalThis.fetch as typeof fetch);
    if (!this.fetchImpl) {
      throw new TransportError("No fetch implementation available. Pass `fetch` in options or run on Node 18+.");
    }
  }

  async request<T>(
    method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    let res: Response;
    try {
      res = await this.fetchImpl(url, init);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new TransportError(`Network error calling ${method} ${path}: ${message}`);
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    if (!res.ok) {
      throw this.toTypedError(res.status, text);
    }

    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new UpstreamError(res.status, `Invalid JSON from ${path}: ${text.slice(0, 200)}`);
    }
  }

  private toTypedError(status: number, text: string): AgentPassportError {
    let envelope: BackendErrorEnvelope | undefined;
    try {
      envelope = JSON.parse(text) as BackendErrorEnvelope;
    } catch {
      // Non-JSON error body — fall through to generic mapping
    }

    const type = envelope?.error?.type;
    const message = envelope?.error?.message ?? `HTTP ${status}`;

    switch (type) {
      case "authentication":
        return new AuthenticationError(message);
      case "not_found":
        return new NotFoundError(message);
      case "validation":
        return new ValidationError(message);
      case "rate_limit":
        return new RateLimitError(envelope?.error?.retry_after_seconds ?? 30, message);
      case "insufficient_balance":
        return new InsufficientBalanceError(message);
      case "domain_not_ready":
        return new DomainNotReadyError(envelope?.error?.domain ?? "unknown", message);
    }

    if (status === 401 || status === 403) return new AuthenticationError(message);
    if (status === 404) return new NotFoundError(message);
    if (status === 429) return new RateLimitError(30, message);
    if (status >= 500) return new UpstreamError(status, message);
    return new UpstreamError(status, message);
  }
}

// ─── Resources ──────────────────────────────────────────────────────────────

class DomainsResource {
  constructor(private readonly http: HttpClient) {}

  add(domain: string): Promise<Domain> {
    return this.http.request<Domain>("POST", "/v1/domains", { domain });
  }

  list(): Promise<Domain[]> {
    return this.http.request<Domain[]>("GET", "/v1/domains");
  }

  status(domain: string): Promise<Domain> {
    return this.http.request<Domain>("GET", `/v1/domains/${encodeURIComponent(domain)}`);
  }

  remove(domain: string): Promise<void> {
    return this.http.request<void>("DELETE", `/v1/domains/${encodeURIComponent(domain)}`);
  }

  /**
   * Block until the domain's status flips to `active` (NS delegation propagated +
   * email DNS preset verified) or the timeout fires.
   *
   * Setup-time only — it's interactive in spirit (the human is watching). Not for
   * agent runtime use.
   */
  async waitActive(domain: string, opts: { timeoutMs?: number; pollIntervalMs?: number } = {}): Promise<Domain> {
    const timeoutMs = opts.timeoutMs ?? 30 * 60 * 1000;
    const pollIntervalMs = opts.pollIntervalMs ?? 5_000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const d = await this.status(domain);
      if (d.status === "active") return d;
      await sleep(pollIntervalMs);
    }
    throw new TimeoutError(`Domain ${domain} did not become active within ${timeoutMs}ms`);
  }
}

class EmailResource {
  constructor(private readonly http: HttpClient) {}

  create(opts: CreateInboxOptions): Promise<Inbox> {
    return this.http.request<Inbox>("POST", "/v1/email/inboxes", opts);
  }

  list(): Promise<Inbox[]> {
    return this.http.request<Inbox[]>("GET", "/v1/email/inboxes");
  }

  delete(address: string): Promise<void> {
    return this.http.request<void>("DELETE", `/v1/email/inboxes/${encodeURIComponent(address)}`);
  }

  send(opts: SendEmailOptions): Promise<{ id: string }> {
    return this.http.request<{ id: string }>("POST", "/v1/email/send", opts);
  }

  /**
   * Read recent messages. Backend handles filter + since cursor + limit.
   */
  read(opts: ReadInboundOptions): Promise<InboundEmail[]> {
    const params = new URLSearchParams();
    params.set("inbox", opts.inbox);
    if (opts.filter !== undefined) params.set("filter", opts.filter);
    if (opts.since !== undefined) params.set("since", opts.since);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    return this.http.request<InboundEmail[]>("GET", `/v1/email/messages?${params.toString()}`);
  }

  /**
   * Async iterable that polls the backend every 5s and yields new messages.
   * Each message carries the full raw RFC 5322 in `msg.raw` — the caller
   * parses whatever they care about (subject, body, OTP, links).
   */
  async *watch(opts: WatchOptions): AsyncIterable<InboundEmail> {
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const pollIntervalMs = 5_000;
    let since = new Date().toISOString();
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const readOpts: ReadInboundOptions = { inbox: opts.inbox, since };
      if (opts.filter !== undefined) readOpts.filter = opts.filter;
      const batch = await this.read(readOpts);
      for (const m of batch) {
        yield m;
        if (m.receivedAt > since) since = m.receivedAt;
      }
      if (batch.length === 0) {
        await sleep(pollIntervalMs);
      }
    }
  }
}

class WalletResource {
  constructor(private readonly http: HttpClient) {}

  balance(): Promise<WalletBalance> {
    return this.http.request<WalletBalance>("GET", "/v1/wallet/balance");
  }

  deposit(amount: number): Promise<WalletBalance> {
    return this.http.request<WalletBalance>("POST", "/v1/wallet/deposit", { amount });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
