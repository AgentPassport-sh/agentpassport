// Shared data types for AgentPassport SDK and CLI.
// No behavior, no node:* imports — these types must work in browser/Worker contexts too.

export type Country = string;
export type City = string;
export type ISO8601 = string;

export type OutputFormat = "human" | "json" | "quiet";

// ─── Network egress (residential proxy) ────────────────────────────────────

/**
 * A short-lived HTTP CONNECT proxy session. Pair `host:port` with
 * `username:password` and feed it to any HTTP client as a proxy:
 *
 *   process.env.HTTPS_PROXY = `http://${s.username}:${s.password}@${s.host}:${s.port}`
 *
 * The session's underlying residential IP is anchored to `country` (and
 * `city` if provided). Same session id, reused within `expiresAt`, returns
 * the same residential IP — that's what `sticky` exposes.
 */
export interface ProxySession {
  host: string;
  port: number;
  username: string;
  password: string;
  country: Country;
  city?: City;
  sticky: boolean;
  expiresAt: ISO8601;
}

// ─── DNS / Domain ──────────────────────────────────────────────────────────

export interface DomainRecord {
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
}

export type DomainStatus = "pending" | "active" | "error";

/**
 * Customer-facing view of a domain registered with AgentPassport.
 * Different from the internal `DnsZone` (SDK provider concept) — this is what
 * the CLI / SDK consumer sees.
 */
export interface Domain {
  domain: string;
  status: DomainStatus;
  nameservers: string[];
  emailReady: boolean;
  createdAt: ISO8601;
}

// ─── Email ─────────────────────────────────────────────────────────────────

export interface Inbox {
  address: string;
  domain: string;
  createdAt: ISO8601;
}

/**
 * An inbound email as exposed to SDK consumers.
 *
 * Standard RFC 5322 headers (From, Subject, Date) and MIME body parts
 * (text/plain, text/html) are parsed server-side using a standard
 * library — these are non-heuristic fields formally defined by the
 * spec, so exposing them is safe and saves the agent from scanning
 * boilerplate (DKIM signatures, ARC chains, Received hops).
 *
 * The full original message is still available in `raw` for edge
 * cases — custom headers, signature inspection, multi-part variants
 * the standard fields don't cover.
 *
 * What we DO NOT do server-side: extract OTP codes, guess sender
 * intent, or otherwise pattern-match the body. Those decisions are
 * the agent's.
 */
export interface InboundEmail {
  id: string;
  /** Final delivery address (envelope-to). */
  to: string;
  /** When AgentPassport received the message. */
  receivedAt: ISO8601;
  /**
   * The sender's `Date:` header, parsed to ISO 8601. May be null if
   * the sender didn't include a parseable Date header.
   */
  sentAt: ISO8601 | null;
  /** Full `From:` header value (including display name when present). */
  from: string;
  /** `Subject:` header value. Empty string if the sender omitted one. */
  subject: string;
  /**
   * Decoded text/plain MIME part. If the sender only ships an HTML
   * body (or ships a useless "This email contains HTML content."
   * placeholder), the server auto-populates this by stripping HTML
   * tags so naive consumers always see something. Null only when
   * both parts are genuinely empty.
   */
  text: string | null;
  /** Decoded text/html MIME part. Null if the message has no HTML part. */
  html: string | null;
  /**
   * Best-effort numeric verification code lifted from subject + body
   * (first 4–8 digit run, server-side). Null if no match. Agents
   * with a different pattern (alphanumeric, longer codes, links)
   * should ignore this and scan `text` / `html` / `raw` themselves.
   */
  code: string | null;
  /** Full RFC 5322 message — headers + body, as delivered. */
  raw: string;
}

// ─── Pricing ───────────────────────────────────────────────────────────────

export interface PricingItem {
  /** Canonical action name (matches wallet_events.action). */
  action: string;
  /** Per-unit cost in tokens. */
  tokens: number;
  /** Convenience USD string ("0.01"); source of truth is `tokens`. */
  usd: string;
  description: string;
}

export interface PricingTable {
  /** 1 token = this many USD. Currently 0.001. */
  tokenUsd: number;
  items: PricingItem[];
}

// ─── Wallet ────────────────────────────────────────────────────────────────

/**
 * Wallet balance in tokens. 1 token = $0.001 (1000 tokens = $1.00).
 * `usdEquivalent` is provided as a convenience string ("12.34") for UI;
 * the source of truth is `tokens` (BIGINT on the server).
 */
export interface WalletBalance {
  tokens: number;
  usdEquivalent: string;
  /** "active" | "low" | "depleted" — server-set, drives UI hints + 402s. */
  state: string;
}

/**
 * A single ledger row. Negative `tokensDelta` is a debit (call charge,
 * bandwidth); positive is a credit (topup, refund, admin grant).
 */
export interface WalletEvent {
  id: string;
  /** e.g. "email.send", "proxy.bandwidth.mb", "topup", "admin.credit". */
  action: string;
  qty: number;
  tokensDelta: number;
  balanceAfterTokens: number;
  /** Domain-object correlate (messageId, sessionId, topupIntent, etc.). */
  ref: string | null;
  createdAt: ISO8601;
}

/**
 * Topup-intent handle returned by `ap.wallet.topup(...)`. Open
 * `checkoutUrl` in a browser / WebView; once the customer pays, our
 * AllScale webhook credits the wallet automatically.
 */
export interface TopupIntent {
  intentId: string;
  allscaleIntentId: string;
  checkoutUrl: string;
  amountCents: number;
  amountCoins: string;
}
