# @agentpassportsh/cli

> CLI for AgentPassport — owned-domain inboxes for AI agents, residential proxies and VPN tunnels next. Agent-first: JSON output, deterministic exit codes, no interactive prompts in the happy path.

```bash
npm install -g @agentpassportsh/cli
```

Registers two binaries: `agentpassport` (formal) and `app` (short, recommended for daily use).

> ⚠️ AgentPassport is **not** [passport.js](https://www.passportjs.org/) (Node.js auth middleware) and **not** an AI-identity or agent-credentials protocol.

## Authenticate

```bash
export AP_API_KEY=ap_live_xxxxxxxx   # or ap_test_* for the dev environment
```

Get a key at https://agentpassport.sh.

## Quick start

```bash
# 1) Bring a domain you own (one-time, 5–30 min for NS to propagate)
app domain add myagent.com
# → prints 2 nameservers; set them at your registrar (GoDaddy, Porkbun, etc.)
app domain status myagent.com --wait

# 2) Provision an inbox — auto-configures MX/SPF on your zone
app email create --domain myagent.com --name support
# → support@myagent.com

# 3) Wait for the next inbound message (full raw RFC 5322 in msg.raw)
app email watch --inbox support@myagent.com --timeout 60s --json
```

## Commands

```
app domain    add | status | list | remove
app email     create | list | delete | send | read | watch
app wallet    balance | deposit
app config    get | set
app login
```

`app proxy` and `app vpn` will land alongside the residential-IP and VPN capabilities.

## Output modes

| Flag | Use case |
| --- | --- |
| _(none)_ | Interactive terminal — color, emoji, formatted tables |
| `--json` | Agent consumption, script parsing (NDJSON for `watch`) |
| `--quiet` | Pipe-friendly — single most important value |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | User error (bad arguments, not found) |
| `2` | System error (network, upstream) |
| `3` | Insufficient balance |

## Documentation

Full docs and the **Agent Skill** (drop-in for Claude / agentic IDEs) live in the [main repository](https://github.com/AgentPassport-sh/agentpassport).

## License

[MIT](https://github.com/AgentPassport-sh/agentpassport/blob/main/LICENSE)
