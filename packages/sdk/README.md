# @agentpassportsh/sdk

> Typed TypeScript SDK for AgentPassport. Drop into any agent (Node 20+, Workers, modern browsers) to provision real-world infrastructure — owned-domain inboxes today, residential proxies and VPN tunnels next.

```bash
npm install @agentpassportsh/sdk
```

> ⚠️ AgentPassport is **not** [passport.js](https://www.passportjs.org/) (Node.js auth middleware) and **not** an AI-identity or agent-credentials protocol. It's infrastructure provisioning.

## Quick start

```ts
import { AgentPassport } from "@agentpassportsh/sdk";

const ap = new AgentPassport({ apiKey: process.env.AP_API_KEY! });

// 1) Provision an inbox on a domain you own
await ap.email.create({ domain: "myagent.com", name: "support" });

// 2) Trigger an external sign-up, then wait for the verification mail
await externalService.startSignup({ email: "support@myagent.com" });

for await (const msg of ap.email.watch({
  inbox: "support@myagent.com",
  timeoutMs: 60_000,
})) {
  // msg.raw is the full RFC 5322 — headers + body, as delivered.
  // Parse whatever the sender used: a numeric code, a confirm link,
  // a header value. The LLM is better at this than any fixed regex.
  const code = msg.raw.match(/\b\d{4,8}\b/)?.[0];
  if (!code) continue;
  await externalService.verify({ email: "support@myagent.com", code });
  break;
}
```

## API surface

```ts
ap.domains
  .add(domain)           // returns NS pair to set at registrar
  .list()
  .status(domain)
  .remove(domain)
  .waitActive(domain)    // block until NS delegation propagates

ap.email
  .create({ domain, name? })
  .list()
  .delete(address)
  .read({ inbox, filter?, since?, limit? })   // most recent first
  .watch({ inbox, filter?, timeoutMs? })      // async iterable of new mail
  .send({ from, to, subject, text?, html?, replyTo? })

ap.wallet
  .balance()
  .deposit(amount)
```

`ap.proxy.*` and `ap.vpn.*` will land alongside the residential-IP and VPN capabilities.

## Inbound message shape

Every inbound message has exactly four fields:

```ts
interface InboundEmail {
  id: string;          // server-generated id
  to: string;          // envelope-to (the inbox that received it)
  receivedAt: string;  // ISO 8601 timestamp
  raw: string;         // full RFC 5322 message (headers + body)
}
```

No `subject`, `from`, `text`, `html`, or `otp` field. The agent reads `raw` and parses what it needs — that's strictly more flexible than any pre-parsed schema we could ship. See the [Agent Skill](https://github.com/AgentPassport-sh/agentpassport/blob/main/skills/agentpassport/SKILL.md) for parsing patterns.

## Typed errors

Every method throws a typed subclass of `AgentPassportError`:

```
AgentPassportError
├── AuthenticationError       bad / revoked API key
├── NotFoundError             inbox / domain doesn't exist
├── ValidationError           malformed request
├── RateLimitError            carries retryAfterSeconds
├── InsufficientBalanceError
├── DomainNotReadyError       NS not propagated yet — wait + retry
├── TimeoutError              watch / waitActive hit the deadline
├── TransportError            network failure
└── UpstreamError             upstream anomaly (rare, transient)
```

```ts
import { AgentPassport, TimeoutError, DomainNotReadyError } from "@agentpassportsh/sdk";

try {
  await ap.domains.waitActive("myagent.com", { timeoutMs: 30 * 60_000 });
} catch (err) {
  if (err instanceof TimeoutError)     return "NS delegation never propagated";
  if (err instanceof DomainNotReadyError) return "domain still in setup";
  throw err;
}
```

## Environment routing

The API key prefix decides which backend:

```
ap_live_*  →  api.agentpassport.sh          (production)
ap_test_*  →  dev.api.agentpassport.sh      (sandbox)
```

Override with the `baseUrl` option (for local development / self-hosted):

```ts
new AgentPassport({ apiKey: "...", baseUrl: "http://localhost:4000" });
```

The SDK does **not** call upstream providers directly — every operation goes through the AgentPassport backend, behind your API key.

## Runs in

Runs on Node 20+, Deno, Bun, edge runtimes (Workers, Vercel Edge), and modern browsers. Uses `fetch` only — no Node built-ins.

## Documentation

- [Main repository + Agent Skill](https://github.com/AgentPassport-sh/agentpassport)
- [CLI companion](https://www.npmjs.com/package/@agentpassportsh/cli)

## License

[MIT](https://github.com/AgentPassport-sh/agentpassport/blob/main/LICENSE)
