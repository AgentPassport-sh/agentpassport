# Example — Verification-code capture during sign-up

The headline flow. An agent needs to sign up at an external service that requires email verification. The agent runs the sign-up form, then blocks waiting for the verification mail to land in an inbox we control, reads the raw message, and pulls out whatever the sender used (a 6-digit code, a confirmation link, etc.).

> AgentPassport hands the agent the **full raw RFC 5322 message** in `msg.raw`. There is no server-side regex, no auto-extracted `otp` field. The agent reads the raw and decides what to do — that's strictly more flexible than any fixed pattern we could ship.

## One-time setup (human, in dashboard or CLI)

```bash
# 1. Bring a domain you own
app domain add myagent.com
# Output:
#   Set these nameservers at your registrar for myagent.com:
#     ns1.agentpassport.sh
#     ns2.agentpassport.sh

# 2. Wait ~5–30 minutes for nameserver propagation, then verify:
app domain status myagent.com --wait

# 3. Create an inbox (typically once, agents reuse it)
app email create --domain myagent.com --name support
# → support@myagent.com
```

## Runtime (agent, via CLI)

```bash
SIGNUP_EMAIL=support@myagent.com

# 1. Agent kicks off the external sign-up (browser automation,
#    HTTP form post, whatever — that part is not AgentPassport's job)
your-signup-script --email "$SIGNUP_EMAIL"

# 2. Block for up to 60 seconds, grab the next message's raw body,
#    and pull the first 4–8 digit run as the OTP. Tweak the regex for
#    the sender's actual format.
RAW=$(app email watch --inbox "$SIGNUP_EMAIL" --timeout 60s --json \
        | head -1 | jq -r .raw)
if [ -z "$RAW" ]; then
  echo "No mail arrived in 60s" >&2
  exit 1
fi
OTP=$(printf '%s' "$RAW" | grep -oE '\b[0-9]{4,8}\b' | head -1)

# 3. Submit the OTP back to the external service
your-signup-script --verify "$OTP"
```

## Runtime (agent, via SDK)

```ts
import { AgentPassport, TimeoutError } from "@agentpassportsh/sdk";

const ap = new AgentPassport({ apiKey: process.env.AP_API_KEY! });
const inbox = "support@myagent.com";

await externalService.startSignup({ email: inbox });

try {
  for await (const msg of ap.email.watch({ inbox, timeoutMs: 60_000 })) {
    // msg.raw is the full RFC 5322. Pull out whatever the sender used.
    const code = msg.raw.match(/\b\d{4,8}\b/)?.[0];
    if (!code) continue; // not the verification mail — keep waiting

    await externalService.verify({ email: inbox, code });
    break;
  }
} catch (err) {
  if (err instanceof TimeoutError) {
    // No mail arrived in 60s. Retry the sign-up, try a different
    // address, or surface the failure.
  } else {
    throw err;
  }
}
```

### Magic-link variant

Some services skip the code and send a click-to-confirm URL. Same flow, different regex:

```ts
for await (const msg of ap.email.watch({ inbox, timeoutMs: 60_000 })) {
  const link = msg.raw.match(/https?:\/\/\S*verify\S*/)?.[0];
  if (!link) continue;
  await fetch(link); // hit the confirm URL
  break;
}
```

## What happens under the hood

1. The external service sends mail to `support@myagent.com`.
2. The MX record points to AgentPassport infrastructure (set up during `app domain add` + `app email create`).
3. Cloudflare Email Routing accepts the message and forwards it to our Email Worker.
4. The Worker streams the raw RFC 5322 bytes to our backend, which stores them untouched.
5. `app email watch` (or `ap.email.watch(...)`) polls every 5s and yields the raw message the moment it lands.
6. **The agent parses the raw and decides what to do.** No server-side extraction — the LLM is better at reading real mail than any regex we could pre-bake.

## Tips

- **`--timeout` value** depends on the service. Most services send the email within 30s; some batch and take up to 5min. Start at 60s, raise if needed.
- **Use `--filter` for noisy inboxes.** Filter matches against the full raw message (headers + body), case-insensitive substring:
  `app email watch --inbox $INBOX --filter "verification" --timeout 60s`
- **Sticky inboxes vs disposable.** AgentPassport inboxes are bound to a domain you own, not disposable. Many services reject disposable-mail providers. This is by design — AgentPassport is _not_ a temp-mail product.
- **Multiple agents, same domain.** Create one inbox per agent (`agent-1@`, `agent-2@`, …) so mail doesn't collide.
- **Let the model read the email.** When the format is unpredictable, skip the regex entirely — print `msg.raw` and ask the LLM what the code or link is. That's why we deliver the raw in the first place.
