# AgentPassport

> Real-world infrastructure for AI agents — owned-domain inboxes, residential proxies, VPN tunnels — exposed through a typed SDK, a CLI, and an [Agent Skill](./skills/agentpassport/SKILL.md).

[![npm](https://img.shields.io/npm/v/@agentpassportsh/cli.svg?label=%40agentpassportsh%2Fcli)](https://www.npmjs.com/package/@agentpassportsh/cli)
[![npm](https://img.shields.io/npm/v/@agentpassportsh/sdk.svg?label=%40agentpassportsh%2Fsdk)](https://www.npmjs.com/package/@agentpassportsh/sdk)
[![license](https://img.shields.io/npm/l/@agentpassportsh/cli.svg)](./LICENSE)

> ⚠️ AgentPassport is **not** [passport.js](https://www.passportjs.org/) (Node.js auth middleware) and **not** an AI-identity or agent-credentials protocol. It's infrastructure provisioning. See [`docs/BRAND.md`](./docs/BRAND.md) for the full disambiguation.

## What it does

| Capability | Today | Tomorrow |
|---|---|---|
| **Email** | ✅ Shipped — real inboxes on a domain you own, with `from` / `subject` / `text` / `html` pre-parsed plus the full RFC 5322 as a fallback | Outbound polish |
| **Domains** | ✅ Shipped — bring your own, delegate nameservers, AgentPassport handles DNS + email DNS records automatically | Domain registration |
| **Proxy** | 🛠 Coming — residential rotating IPs by country/city | — |
| **VPN** | 🛠 Coming — WireGuard tunnels in any region | — |

The headline flow: spin up an inbox `support@myagent.com`, point an external sign-up at it, watch the verification code land. The agent gets a clean view (`msg.from`, `msg.subject`, `msg.text`, `msg.html`) parsed from the standard RFC 5322 fields — plus `msg.raw` for edge cases — and decides what to do with it. No server-side OTP extraction, no content-pattern guessing.

## Install

Two surfaces, install either or both:

```bash
# CLI — for humans, shell scripts, and `bash`-style agent loops
npm install -g @agentpassportsh/cli

# SDK — for TypeScript / Node agents
npm install @agentpassportsh/sdk
```

You need an API key — sign up at https://agentpassport.sh and grab one.

```bash
export AP_API_KEY=ap_live_xxxxxxxx   # or ap_test_* for the dev environment
```

The key prefix auto-routes between production and dev — same package, same code, no extra config.

## 60-second example

Sign up at an external service, capture the verification code from the email, submit it back. Shell version:

```bash
# 1) Bring a domain you own (one-time, takes 5–30 min to propagate)
app domain add myagent.com
# → returns 2 nameservers; copy them to your registrar (GoDaddy, Porkbun, etc.)

app domain status myagent.com --wait

# 2) Create an inbox (auto-configures MX + SPF on your zone)
app email create --domain myagent.com --name support
# → support@myagent.com

# 3) Trigger the external sign-up, then wait for mail
your-signup-script --email support@myagent.com

RAW=$(app email watch --inbox support@myagent.com --timeout 60s --json \
        | head -1 | jq -r .raw)
CODE=$(printf '%s' "$RAW" | grep -oE '\b[0-9]{4,8}\b' | head -1)

your-signup-script --verify "$CODE"
```

TypeScript version:

```ts
import { AgentPassport } from "@agentpassportsh/sdk";

const ap = new AgentPassport({ apiKey: process.env.AP_API_KEY! });
const inbox = "support@myagent.com";

await externalService.startSignup({ email: inbox });

for await (const msg of ap.email.watch({ inbox, timeoutMs: 60_000 })) {
  // msg.text / msg.from / msg.subject are pre-parsed standard fields.
  // msg.raw is the full RFC 5322 if you need something custom (signing,
  // List-Unsubscribe headers, multipart oddities, etc.).
  const code = (msg.text ?? "").match(/\b\d{4,8}\b/)?.[0];
  if (!code) continue;
  await externalService.verify({ email: inbox, code });
  break;
}
```

## Agent Skill

The [Anthropic Skill](https://docs.anthropic.com/en/docs/build-with-claude/skills) lives at [`skills/agentpassport/`](./skills/agentpassport/). Drop it into your agent and it'll know when to spin up an inbox, how to parse the raw RFC 5322 message, and when *not* to use AgentPassport (e.g. when the user asked for a temp-mail service — AgentPassport requires an owned domain).

As proxy and VPN ship, the same `SKILL.md` grows to cover them — no extra skill to install or re-load.

## Why no server-side OTP extraction?

Every transactional sender frames verification differently:

```
"Your code is 482910"
"Click to confirm: https://service.example/v/abc123"
"<html>...<table><tr><td><b>3829</b></td>...</table>..."
"Two-step: visit the link, then enter the code that arrives"
```

Any regex shipped server-side is wrong for some of these. We parse the standard RFC 5322 fields (`From`, `Subject`, `Date`) and MIME body parts (`text`, `html`) — those are spec-defined and safe — but we don't try to guess what the "code" or "link" is. The LLM is strictly better than any fixed pattern at that. See the [skill docs](./skills/agentpassport/SKILL.md) for parsing patterns.

## Packages

| Package | What it is |
|---|---|
| [`@agentpassportsh/cli`](./packages/cli) | CLI entry point. Registers `agentpassport` and `app` binaries |
| [`@agentpassportsh/sdk`](./packages/sdk) | Typed HTTPS client. `AgentPassport` facade + typed error hierarchy |
| [`@agentpassportsh/types`](./packages/types) | Shared TypeScript types (wire shapes, public interfaces) |
| `@agentpassportsh/mcp` *(private)* | MCP server — coming later |

## CLI cheat sheet

```bash
# Domains
app domain add <yourdomain.com>           # get NS pair to set at your registrar
app domain status <yourdomain.com>        # pending → active
app domain list

# Inboxes
app email create --domain <yourdomain.com> --name <local-part>
app email list
app email delete --address <local@yourdomain.com>

# Reading mail (the agent-runnable part)
app email read  --inbox <addr> -n 20 --json
app email watch --inbox <addr> --timeout 60s --json
app email watch --inbox <addr> --filter "verification" --timeout 60s --json
```

Every command supports `--json` (machine-readable) and `--quiet` (single value, pipe-friendly). Exit codes: `0` ok, `1` user error, `2` system/upstream, `3` insufficient balance.

## Local development

Monorepo, pnpm workspaces, Node 20+.

```bash
pnpm install
pnpm build           # types → sdk → cli → mcp, in dependency order
pnpm --filter @agentpassportsh/cli dev    # CLI in watch mode
```

The CLI / SDK talk to the AgentPassport backend over HTTPS. For local-backend development, point either at it:

```bash
export AP_BASE_URL=http://localhost:4000      # CLI
# or
new AgentPassport({ apiKey: "...", baseUrl: "http://localhost:4000" });   // SDK
```

## Contributing

Issues and PRs welcome at https://github.com/AgentPassport-sh/agentpassport.

This repo is the public surface — CLI, SDK, types, and agent skills. The backend service these talk to is closed-source. If you want a self-hosted setup, open an issue and let's discuss.

## License

[MIT](./LICENSE)
