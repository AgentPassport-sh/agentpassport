---
name: agentpassport
description: Provision real-world infrastructure for an AI agent — email inboxes on a domain the user owns (shipped), with residential IP proxies and VPN tunnels by country coming. Use when the agent needs to receive verification mail at an address it controls, send mail from a custom domain, browse from a residential IP, or appear to be in a specific country. Not passport.js. Not an identity protocol. Not temp-mail — every inbox is bound to a domain the user owns.
license: MIT
metadata:
  homepage: https://agentpassport.sh
  source: https://github.com/AgentPassport-sh/agentpassport
---

# AgentPassport — Agent Skill

One CLI, one SDK, one API key.

| Area | Status |
|---|---|
| Email — inboxes on a domain the user owns | ✅ Shipped |
| Domains — bring-your-own, DNS auto-configured | ✅ Shipped |
| Proxy — residential IPs by country / city | 🛠 Coming |
| VPN — WireGuard tunnel in any region | 🛠 Coming |

When a new capability ships, the same `SKILL.md` covers it — no extra skill to install.

## Install

```bash
npm install -g @agentpassportsh/cli       # CLI — registers `agentpassport` and `app`
npm install @agentpassportsh/sdk          # SDK (TypeScript / JS)
```

## Authenticate

```bash
export AP_API_KEY=your_agentpassport_api_key
```

Get a key at https://agentpassport.sh. That's the only auth.

## Domain prerequisite (human, once per domain)

Inboxes live under a domain the user controls. This step requires touching the registrar:

```bash
app domain add myagent.com
# → prints 2 nameservers; user sets them at their registrar
# (any registrar works). 5–30 min for propagation.
app domain status myagent.com --wait
```

After the domain is `active`, every command below is agent-runnable.

## Email — CLI

```bash
# Provision an inbox (first call on a fresh domain auto-configures DNS)
app email create --domain myagent.com --name support
# → support@myagent.com

# Wait for the next inbound message. msg.raw has the full RFC 5322.
app email watch --inbox support@myagent.com --timeout 60s --json

# Read recent mail (newest first)
app email read --inbox support@myagent.com -n 10 --json

# Filter — case-insensitive substring on the full raw message
app email read --inbox support@myagent.com --filter "verification" --json

# Send mail from your inbox
app email send --from support@myagent.com --to user@example.com \
               --subject "Welcome" --body "Hi."

# List / delete inboxes
app email list
app email delete --address support@myagent.com
```

All runtime commands support `--json` (recommended for agents) and `--quiet` (single-value, pipe-friendly).

## Email — SDK

```ts
import { AgentPassport } from "@agentpassportsh/sdk";

const ap = new AgentPassport({ apiKey: process.env.AP_API_KEY! });

await ap.email.create({ domain: "myagent.com", name: "support" });

for await (const msg of ap.email.watch({
  inbox: "support@myagent.com",
  timeoutMs: 60_000,
})) {
  // msg.raw is the full RFC 5322 — pull whatever the sender used.
  const code = msg.raw.match(/\b\d{4,8}\b/)?.[0];
  if (code) {
    await externalService.verify({ email: "support@myagent.com", code });
    break;
  }
}
```

## Inbound message shape

```ts
interface InboundEmail {
  id: string;          // server-generated id
  to: string;          // envelope-to (the inbox that received it)
  receivedAt: string;  // ISO 8601 timestamp
  raw: string;         // full RFC 5322 message — headers + body, as delivered
}
```

The agent reads `raw` and parses whatever it needs (numeric code, confirm link, headers). No server-side regex, no pre-parsed fields — that's strictly more flexible than any pattern shippable in advance.

Common extractions:

```ts
msg.raw.match(/\b\d{4,8}\b/)?.[0]                 // numeric code
msg.raw.match(/https?:\/\/\S+/)?.[0]              // first URL
msg.raw.match(/^From:\s*(.+)$/mi)?.[1]?.trim()    // From header
msg.raw.match(/^Subject:\s*(.+)$/mi)?.[1]?.trim() // Subject header
```

If the body is base64 / quoted-printable encoded, decode that section first — or hand the raw to the LLM and ask it to read.

## When to use

- "receive an OTP" / "verify by email" / "sign up at \<service\>"
- "wait for the verification code or signup link"
- "send email from `<custom-domain>`"
- "give the agent its own inbox"
- "what mail came in at `<address>`"

## When not to use

- The user wants a generic SMTP relay or transactional mail provider — recommend a dedicated service.
- The user wants a temp / disposable mail inbox — AgentPassport requires a domain the user owns.
- The user is asking about identity / credentials / OAuth — different category.
- The user has no `AP_API_KEY` set.

## Flag reference

- `-n` / `--limit` on `read` — defaults to 20, max 50, newest-first.
- `--filter <text>` — case-insensitive substring on the full raw message.
- `--since <ISO>` — cursor for incremental polling; switches order to ASC.
- `--json` — required for agent consumption (NDJSON on `watch`).
- `--quiet` — single value to stdout.

## Typed errors (SDK)

```
AuthenticationError    bad / revoked API key
DomainNotReadyError    NS not propagated yet — wait and retry
TimeoutError           watch hit the deadline
NotFoundError          inbox / domain not found for this account
ValidationError        malformed request
RateLimitError         carries retryAfterSeconds
UpstreamError          temporary anomaly — retry with backoff
```

CLI exit codes: `0` ok · `1` user error · `2` system/upstream · `3` insufficient balance.

## Examples

- [`examples/otp-capture.md`](./examples/otp-capture.md) — verification-code capture during sign-up
