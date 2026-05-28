---
name: agentpassport-email
description: Provision real inboxes on customer-owned domains and read mail sent to them. Each message is delivered as the full raw RFC 5322 — the agent parses whatever it cares about (subject, body, codes, links, HTML). Use when an agent needs to receive verification mail at a domain it controls, or send mail from a custom address. Not an SMTP relay or temp-mail service — addresses are bound to domains the user owns.
license: MIT
metadata:
  homepage: https://agentpassport.sh
  source: https://github.com/AgentPassport-sh/agentpassport
  capability: email
---

# AgentPassport — Email

Inboxes bound to customer-owned domains. Every inbound message is handed to the agent as the full raw RFC 5322 (headers + body, exactly as the sender delivered it). The agent reads the raw on demand and parses whatever it actually needs — subject, body text, embedded codes, signup links, HTML. No server-side regex, no pre-structured fields.

> **Not** [passport.js](https://www.passportjs.org/) (Node auth middleware). **Not** an AI-identity protocol. **Not** a temp-mail / disposable-inbox service — every address is tied to a domain the user owns (via DNS delegation).

## Why raw-only

Every transactional sender frames verification differently:

- `Your code is 482910`
- `Use this link to confirm: https://...`
- HTML-only with the code inside a `<table>` cell
- Multi-step (click link → land on page → second code arrives)

Any regex we ship will be wrong for some of these. The LLM is better at reading a real email than a hard-coded pattern, so we hand it the raw bytes and trust it.

## When to use

Trigger when the user's request involves any of:

- "receive an OTP" / "verify by email" / "sign up at <service>"
- "wait for the verification code / signup link"
- "send email from `<custom-domain>`" / "reply to a customer at `support@mybrand.com`"
- "give the agent its own inbox"
- "what mail came in at `<address>`"

## When not to use

- The user wants an SMTP relay or transactional mail provider — use Resend/Mailgun directly.
- The user wants a temp / disposable / 10-minute mail service — AgentPassport requires the user to own a domain.
- The user is asking about identity / credentials / OAuth — that's a different category entirely.
- The user has not signed up at https://agentpassport.sh or has no `AP_API_KEY` set.

## Authentication

```bash
export AP_API_KEY=ap_live_xxxxxxxx   # or ap_test_*
```

The SDK auto-routes based on key prefix:

```
ap_live_*  →  https://api.agentpassport.sh    (production)
ap_test_*  →  sandbox environment              (for development / testing)
```

Override (local backend):

```bash
export AP_BASE_URL=http://localhost:4000
```

## Prerequisite: an active domain

Inboxes live under a domain the user has already delegated to AgentPassport. The one-time setup is human-run:

```bash
app domain add myagent.com
# → returns 2 Cloudflare nameservers; user copies them to their registrar
# (GoDaddy / Porkbun / etc.). After 5–30 min the domain flips to
# status=active automatically.
```

After that, **every email operation below is agent-runnable** — no manual configuration per inbox.

## CLI commands

```bash
# Provision an inbox. The first call on a fresh domain automatically
# writes MX + SPF to the customer's CF zone and points the catch_all
# routing rule at our Email Worker — the agent doesn't see any of this,
# it just gets a working address back.
app email create --domain myagent.com --name support
# → support@myagent.com

# Block until a new message arrives. The full raw RFC 5322 is in msg.raw —
# the agent parses whatever it needs.
app email watch --inbox support@myagent.com --timeout 60s --json

# Read recent mail (newest first)
app email read --inbox support@myagent.com -n 10 --json

# Filter on the raw message body/headers (substring, case-insensitive)
app email read --inbox support@myagent.com --filter "verification" --json

# Send outbound (currently mocked, returns a fake id — real send is coming)
app email send --from support@myagent.com --to user@x.com \
               --subject "Welcome" --body "Hi."

# List / delete inboxes
app email list
app email delete --address support@myagent.com
```

All runtime commands support `--json` (recommended for agents) and `--quiet` (single-value, pipe-friendly).

## Message shape

Every inbound message has exactly four fields:

```ts
interface InboundEmail {
  id: string;          // server-generated id
  to: string;          // envelope-to (the inbox that received it)
  receivedAt: string;  // ISO 8601 timestamp
  raw: string;         // full RFC 5322 message (headers + body, as delivered)
}
```

That's it. No `subject`, no `from`, no `text`/`html`, no `otp`. The agent reads `raw` and parses whatever it needs.

## SDK usage

```ts
import { AgentPassport, TimeoutError } from "@agentpassportsh/sdk";

const ap = new AgentPassport({ apiKey: process.env.AP_API_KEY! });

// 1) one-time-per-inbox setup (idempotent on existing inboxes)
await ap.email.create({ domain: "myagent.com", name: "support" });

// 2) trigger the external sign-up that sends a verification to support@myagent.com
await externalService.startSignup({ email: "support@myagent.com" });

// 3) wait for the next message and read its raw RFC 5322
for await (const msg of ap.email.watch({
  inbox: "support@myagent.com",
  timeoutMs: 60_000,
})) {
  // msg.raw is the full email. Pull out whatever the sender used —
  // a 6-digit code in the body, a confirm link, a magic token in
  // a header. The agent reasons about the raw text directly.
  console.log(msg.raw);
  break;
}
```

### Parsing the raw message

You decide what to extract. A few patterns that show up often:

```ts
// Body line containing a numeric code (anywhere from 4–8 digits)
const code = msg.raw.match(/\b\d{4,8}\b/)?.[0];

// First confirmation link
const link = msg.raw.match(/https?:\/\/\S+/)?.[0];

// Specific header
const from = msg.raw.match(/^From:\s*(.+)$/mi)?.[1]?.trim();

// Subject line
const subject = msg.raw.match(/^Subject:\s*(.+)$/mi)?.[1]?.trim();
```

If the sender uses quoted-printable or base64 in the body, decode that section before pattern-matching — or, more often, just ask the LLM to read the raw and tell you what the code is. That's the whole point.

## Flag notes for LLM callers

- **`-n` / `--limit`** on `read` — defaults to 20, max 50. Results are newest-first.
- **`--filter <text>`** — case-insensitive substring search on the full raw message (headers + body). Cheap, useful for narrowing to a sender or subject.
- **`--since <ISO>`** — backend cursor; switches result order to chronological (ASC) so watch loops process oldest-first.

## Typed errors

All SDK methods throw a typed subclass of `AgentPassportError`:

```
AuthenticationError    | bad / revoked API key — re-export AP_API_KEY
DomainNotReadyError    | NS not propagated yet — wait ~5–30 min after `app domain add`
TimeoutError           | watch hit the deadline — raise --timeout or retry
NotFoundError          | inbox / domain doesn't exist for this tenant
ValidationError        | malformed request — bad domain, bad local-part, etc.
RateLimitError         | back off; .retryAfterSeconds tells you how long
UpstreamError          | Cloudflare or Resend rejected — usually transient
```

CLI exit codes map to: `0` ok, `1` user error, `2` system / upstream, `3` insufficient balance.

## Examples

- [`examples/otp-capture.md`](./examples/otp-capture.md) — end-to-end agent sign-up flow that reads the raw message and pulls out the code

## See also

This is the **email** capability. Other AgentPassport capabilities live in their own skills:

- `agentpassport-proxy` — residential IP proxy sessions (not yet shipped)
- `agentpassport-vpn` — WireGuard VPN tunnels (not yet shipped)

When those land they'll be separately-triggered skills with their own command surface. Each capability is independent — Claude Code's skill router picks the right one based on the user's request, you don't load all of them at once.
