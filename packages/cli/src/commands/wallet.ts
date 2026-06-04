import { Command } from "commander";
import { makeClient } from "../client.js";
import { chooseMode, emit, ok, kv, table, colors, info } from "../output.js";
import type { TopupIntent, WalletBalance, WalletEvent } from "@agentpassportsh/sdk";

export function registerWallet(program: Command): void {
  const cmd = program.command("wallet").description("Balance, ledger, topup");

  cmd
    .command("balance")
    .description("Show current balance + state")
    .option("--json", "JSON output")
    .option("--quiet", "Quiet output (prints the USD equivalent)")
    .action(async (flags: { json?: boolean; quiet?: boolean }) => {
      const ap = await makeClient();
      const b = await ap.wallet.balance();
      emit(chooseMode(flags), b, {
        human: (x) => printBalance(x),
        quiet: (x) => x.usdEquivalent,
      });
    });

  cmd
    .command("events")
    .description("Recent wallet ledger rows (debits + credits, newest first)")
    .option("-n, --limit <n>", "max events", "20")
    .option("--json", "JSON output")
    .action(async (flags: { limit?: string; json?: boolean }) => {
      const ap = await makeClient();
      const limit = Number(flags.limit ?? 20);
      const events = await ap.wallet.events({ limit });
      emit(chooseMode(flags), events, {
        human: (rows) => {
          if (rows.length === 0) {
            info("No wallet events yet.");
            return;
          }
          table(
            ["WHEN", "ACTION", "QTY", "ΔTOKENS", "BALANCE", "REF"],
            rows.map((e) => [
              new Date(e.createdAt).toLocaleString(),
              e.action,
              String(e.qty),
              formatDelta(e.tokensDelta),
              String(e.balanceAfterTokens),
              e.ref ?? "",
            ]),
          );
        },
        quiet: () => null,
      });
    });

  cmd
    .command("topup")
    .description("Create an AllScale checkout intent (returns a URL to open)")
    .requiredOption("--amount <usd>", "USD amount (number)")
    .option("--redirect <url>", "Where AllScale should redirect after payment")
    .option("--json", "JSON output")
    .option("--quiet", "Quiet output (prints the checkout URL)")
    .action(
      async (flags: {
        amount: string;
        redirect?: string;
        json?: boolean;
        quiet?: boolean;
      }) => {
        const ap = await makeClient();
        const amountUsd = Number(flags.amount);
        if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
          process.stderr.write(`\x1b[31m✗\x1b[0m --amount must be a positive number\n`);
          process.exit(1);
        }
        const params: { amountUsd: number; redirectUrl?: string } = { amountUsd };
        if (flags.redirect) params.redirectUrl = flags.redirect;
        const intent = await ap.wallet.topup(params);
        emit(chooseMode(flags), intent, {
          human: (x: TopupIntent) => {
            ok("Topup intent created");
            kv([
              ["amountCents", String(x.amountCents)],
              ["amountCoins (USDT)", x.amountCoins],
              ["intentId", x.intentId],
            ]);
            process.stdout.write("\n");
            process.stdout.write(
              colors.dim("Open this URL in a browser to complete payment:\n"),
            );
            process.stdout.write("  " + colors.cyan(x.checkoutUrl) + "\n");
          },
          quiet: (x: TopupIntent) => x.checkoutUrl,
        });
      },
    );
}

function printBalance(b: WalletBalance): void {
  ok("Balance");
  const stateColored =
    b.state === "active"
      ? colors.green(b.state)
      : b.state === "low"
        ? colors.yellow(b.state)
        : colors.red(b.state);
  kv([
    ["balance", `$${b.usdEquivalent}`],
    ["tokens", String(b.tokens)],
    ["state", stateColored],
  ]);
}

function formatDelta(n: number): string {
  if (n > 0) return colors.green(`+${n}`);
  if (n < 0) return colors.red(String(n));
  return "0";
}
