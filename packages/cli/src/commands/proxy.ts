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
    .option("--duration <minutes>", "Session lifetime in minutes (default 30, max 10080 = 7 days)")
    .option(
      "--bind-to <key>",
      "Pin this key (e.g. an inbox address) to one IP across mints",
    )
    .option("--export", "Print a single line: export HTTPS_PROXY=... (pipe-friendly)")
    .option("--json", "JSON output")
    .option("--quiet", "Quiet output (prints the http://user:pass@host:port URL)")
    .action(
      async (flags: {
        country: string;
        city?: string;
        sticky?: boolean;
        duration?: string;
        bindTo?: string;
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
          bindTo?: string;
        } = { country: flags.country };
        if (flags.city !== undefined) params.city = flags.city;
        if (flags.sticky === false) params.sticky = false;
        if (flags.duration !== undefined) {
          const n = Number(flags.duration);
          if (Number.isFinite(n)) params.durationMinutes = n;
        }
        if (flags.bindTo !== undefined) params.bindTo = flags.bindTo;

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

  cmd
    .command("bindings")
    .description("List pinned keys and the IP each one uses")
    .option("--json", "JSON output")
    .action(async (flags: { json?: boolean }) => {
      const ap = await makeClient();
      const bindings = await ap.proxy.bindings();
      emit(chooseMode(flags), bindings, {
        human: (rows) => {
          if (rows.length === 0) {
            ok("No pinned keys yet — mint a session with --bind-to to create one");
            return;
          }
          ok(`${rows.length} pinned key${rows.length === 1 ? "" : "s"}`);
          for (const b of rows) {
            const kvRows: Array<[string, string | number | undefined | null]> = [
              ["bindTo", b.bindTo],
              ["ip", b.ip ?? colors.dim("(not discovered yet)")],
              ["country", b.country.toUpperCase()],
            ];
            if (b.city) kvRows.push(["city", b.city]);
            kv(kvRows);
            process.stdout.write("\n");
          }
        },
        quiet: (rows) => rows.map((b) => `${b.bindTo}\t${b.ip ?? ""}`).join("\n"),
      });
    });

  cmd
    .command("unbind")
    .description("Drop a pin — the next session for that key gets a new IP")
    .requiredOption("--bind-to <key>", "The pinned key to release")
    .option("--json", "JSON output")
    .action(async (flags: { bindTo: string; json?: boolean }) => {
      const ap = await makeClient();
      const res = await ap.proxy.unbind(flags.bindTo);
      emit(chooseMode(flags), res, {
        human: () => ok(`Unpinned ${flags.bindTo}`),
        quiet: (d) => d.deleted,
      });
    });
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
  const rows: Array<[string, string | number | undefined | null]> = [
    ["host", s.host],
    ["port", String(s.port)],
    ["country", s.country.toUpperCase()],
  ];
  if (s.city) rows.push(["city", s.city]);
  rows.push(["sticky", s.sticky ? "yes" : "no"]);
  if (s.bindTo) {
    rows.push(["bindTo", s.bindTo]);
    rows.push(["ip", s.boundIp ?? "(not discovered yet)"]);
  }
  rows.push(["expiresAt", s.expiresAt]);
  kv(rows);
  process.stdout.write("\n");
  process.stdout.write(colors.dim("Use with any HTTP client:\n"));
  process.stdout.write(
    "  " + colors.cyan(`HTTPS_PROXY=${proxyUrl(s)}`) + "\n",
  );
}
