# @agentpassportsh/types

> Shared TypeScript types for the AgentPassport SDK and CLI.

```bash
npm install --save-dev @agentpassportsh/types
```

This package contains data types only — no behavior, no `node:*` imports. Safe to import from Node, the browser, edge runtimes, or any other JS runtime.

You normally do **not** install this directly — it is a transitive dependency of [`@agentpassportsh/sdk`](https://www.npmjs.com/package/@agentpassportsh/sdk). Install it explicitly only if you are building tooling on top of the SDK that wants to reference the same type definitions.

## What's in it

- `Domain`, `Inbox`, `InboundEmail` — wire shapes returned by the API
- `ProxySession`, `VpnConnection` — runtime resource shapes
- `Country`, `City`, `ISO8601`, `OutputFormat` — primitives

## License

MIT
