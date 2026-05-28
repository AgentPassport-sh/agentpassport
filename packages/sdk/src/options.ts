// Public option shapes used by the AgentPassport facade.

export interface CreateInboxOptions {
  /** Domain you've already registered with AgentPassport (one-time setup). */
  domain: string;
  /** Local part of the address. Defaults to a random readable handle. */
  name?: string;
}

export interface SendEmailOptions {
  /** Must be an inbox you own (created via `email.create`). */
  from: string;
  to: string;
  subject: string;
  /** Plain-text body. At least one of `text` or `html` is required. */
  text?: string;
  /** HTML body. At least one of `text` or `html` is required. */
  html?: string;
  replyTo?: string;
}

export interface ReadInboundOptions {
  inbox: string;
  /** Substring match on the full raw RFC 5322 message (headers + body). */
  filter?: string;
  /** ISO timestamp cursor — only return messages received after this. */
  since?: string;
  /** Max messages to return. Defaults to 50 server-side. */
  limit?: number;
}

export interface WatchOptions {
  inbox: string;
  filter?: string;
  /** Maximum time to keep polling, in milliseconds. Defaults to 60_000. */
  timeoutMs?: number;
}
