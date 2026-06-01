import { Command } from "commander";
import { makeClient } from "../client.js";
import { chooseMode, emit, ok, kv, colors } from "../output.js";
import type { ProxySession } from "@agentpassportsh/sdk";

export function registerProxy(program: Command): void {
  const cmd = program
    .command("proxy")
    .description("Country-anchored residential proxy sessions");

  cmd
    .command("session")
    .description("Mint a proxy session — returns host:port + credentials")
    .requiredOption("--country <cc>", "ISO-3166 alpha-2 country code (e.g. US, GB, JP)")
    .option("--city <slug>", "Optional city slug (e.g. new-york, london)")
    .option("--no-sticky", "Don't pin to a single residential IP")
    .option("--duration <minutes>", "Session lifetime in minutes (default 30, max 60)")
    .option("--export", "Print a single line: export HTTPS_PROXY=... (pipe-friendly)")
    .option("--json", "JSON output")
    .option("--quiet", "Quiet output (prints the http://user:pass@host:port URL)")
    .action(
      async (flags: {
        country: string;
        city?: string;
        sticky?: boolean;
        duration?: string;
        export?: boolean;
        json?: boolean;
        quiet?: boolean;
      }) => {
        const ap = await makeClient();
        const params: {
          country: string;
          city?: string;
          sticky?: boolean;
          durationMinutes?: number;
        } = { country: flags.country };
        if (flags.city !== undefined) params.city = flags.city;
        if (flags.sticky === false) params.sticky = false;
        if (flags.duration !== undefined) {
          const n = Number(flags.duration);
          if (Number.isFinite(n)) params.durationMinutes = n;
        }

        const session = await ap.proxy.session(params);
        const mode = chooseMode(flags);

        // --export takes precedence over --json/--quiet: it's the only
        // form that's safe to `eval` and that's the explicit ask.
        if (flags.export) {
          process.stdout.write(`export HTTPS_PROXY=${proxyUrl(session)}\n`);
          process.stdout.write(`export HTTP_PROXY=${proxyUrl(session)}\n`);
          return;
        }

        emit(mode, session, {
          human: (s) => printSession(s),
          quiet: (s) => proxyUrl(s),
        });
      },
    );
}

function proxyUrl(s: ProxySession): string {
  // No URL-encoding on user/pass: the JWT username has no special URL
  // chars, and the password is the literal "x". Encode anyway in case
  // the format ever changes.
  return `http://${encodeURIComponent(s.username)}:${encodeURIComponent(
    s.password,
  )}@${s.host}:${s.port}`;
}

function printSession(s: ProxySession): void {
  ok("Proxy session ready");
  kv([
    ["host", s.host],
    ["port", String(s.port)],
    ["country", s.country.toUpperCase()],
    ...(s.city ? ([["city", s.city]] as const) : []),
    ["sticky", s.sticky ? "yes" : "no"],
    ["expiresAt", s.expiresAt],
  ]);
  process.stdout.write("\n");
  process.stdout.write(colors.dim("Use with any HTTP client:\n"));
  process.stdout.write(
    "  " + colors.cyan(`HTTPS_PROXY=${proxyUrl(s)}`) + "\n",
  );
}
