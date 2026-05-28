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
 * An inbound email as exposed to SDK consumers. Raw-only — the agent
 * receives the full RFC 5322 message and parses whatever it actually
 * cares about (subject, from, body, embedded codes, HTML links).
 *
 * Service-side parsing was removed 2026-05-28: every regex assumption
 * we made (OTP shape, subject patterns) was fragile and pre-empted the
 * agent's reasoning. The agent is smarter than our regex.
 */
export interface InboundEmail {
  id: string;
  /** Final delivery address (envelope-to). */
  to: string;
  receivedAt: ISO8601;
  /** Full RFC 5322 message including all headers + body. */
  raw: string;
}

// ─── Wallet ────────────────────────────────────────────────────────────────

export interface WalletBalance {
  currency: "USDC";
  amount: number;
}
