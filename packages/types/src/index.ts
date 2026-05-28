// Shared data types for AgentPassport SDK and CLI.
// No behavior, no node:* imports — these types must work in browser/Worker contexts too.

export type Country = string;
export type City = string;
export type ISO8601 = string;

export type OutputFormat = "human" | "json" | "quiet";

// ─── Proxy ─────────────────────────────────────────────────────────────────

export interface ProxySession {
  endpoint: string;
  username: string;
  password: string;
  country: Country;
  city?: City;
  sticky?: boolean;
  expiresAt?: ISO8601;
}

// ─── VPN ───────────────────────────────────────────────────────────────────

export interface VpnConnection {
  provider: string;
  country: Country;
  city?: City;
  publicIp?: string;
  connectedAt?: ISO8601;
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
  /** Decoded text/plain MIME part. Null if the message has no plain-text part. */
  text: string | null;
  /** Decoded text/html MIME part. Null if the message has no HTML part. */
  html: string | null;
  /** Full RFC 5322 message — headers + body, as delivered. */
  raw: string;
}

// ─── Wallet ────────────────────────────────────────────────────────────────

export interface WalletBalance {
  currency: "USDC";
  amount: number;
}
