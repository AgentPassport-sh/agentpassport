# Brand disambiguation

The name "agent passport" (and close variants) is unusually crowded. This page exists so you can quickly tell whether you're in the right place.

## What AgentPassport IS

A CLI + SDK that **provisions real-world infrastructure for AI agents**:

- Email inboxes on a domain you own (today)
- Residential IP proxies (coming)
- WireGuard VPN tunnels (coming)
- DNS for your owned domains (today, as a side-effect of email setup)

That's the entire surface. No protocols, no identity issuance, no signed credentials, no on-chain anything.

## What AgentPassport is NOT

### Not passport.js

[passport.js](https://www.passportjs.org/) is Node.js authentication middleware — a popular library for handling username/password, OAuth, SAML strategies in web apps. AgentPassport has no relationship to it.

### Not any AI-identity / agent-credentials protocol

Multiple projects use the words "agent passport" or close variants for **AI-agent identity protocols** — verifiable credentials, signed agent IDs, OAuth-for-agents flows. Examples that exist as of 2026-05:

| Project | What it is |
| --- | --- |
| `agentpassportai/agent-passport` | "OAuth for the agentic era" — consent gating, spend limits, audit trails |
| `agent-passport.org` | Apache 2.0 protocol — verifiable identity for AI agents |
| `agentspassports.com` | "Cryptographically signed identity documents for AI agents" |
| `agentauths.com` | "Passport for AI Agents — Soul Layer, ZKP, Anti-Drift" |
| Various ERC-8004 / World-ID Agent Passport implementations | On-chain agent identity protocols |

These are all **identity protocols**. AgentPassport (this project) is **infrastructure provisioning**. We do not issue, sign, or verify any identity. We don't claim interoperability with these projects.

## Canonical disclaimer

> AgentPassport is a CLI + SDK for provisioning agent infrastructure (inboxes, IPs, DNS, VPN). It is not related to passport.js and is not an AI-identity protocol.

This sentence (or a close paraphrase) appears as the first non-tagline line of every README, npm description, and the CLI `--help` output.
