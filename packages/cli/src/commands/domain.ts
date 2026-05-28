import { Command } from "commander";
import { makeClient } from "../client.js";
import { chooseMode, emit, ok, info, kv, table, colors } from "../output.js";
import type { Domain } from "@agentpassportsh/sdk";

export function registerDomain(program: Command): void {
  const cmd = program.command("domain").description("DNS zones — bring your own domain");

  cmd
    .command("add <domain>")
    .description("Register a domain with AgentPassport (returns NS pair to set at your registrar)")
    .option("--json", "JSON output")
    .option("--quiet", "Quiet output (prints the first nameserver)")
    .action(async (domain: string, flags: { json?: boolean; quiet?: boolean }) => {
      const ap = await makeClient();
      const result = await ap.domains.add(domain);
      emit(chooseMode(flags), result, {
        human: (d) => printDomainAdded(d),
        quiet: (d) => d.nameservers[0] ?? null,
      });
    });

  cmd
    .command("list")
    .description("List domains registered to your tenant")
    .option("--json", "JSON output")
    .action(async (flags: { json?: boolean }) => {
      const ap = await makeClient();
      const domains = await ap.domains.list();
      emit(chooseMode(flags), domains, {
        human: (ds) => {
          if (ds.length === 0) {
            info("No domains registered. Try `app domain add <domain>`.");
            return;
          }
          table(
            ["DOMAIN", "STATUS", "EMAIL READY", "CREATED"],
            ds.map((d) => [d.domain, d.status, d.emailReady ? "yes" : "no", d.createdAt]),
          );
        },
        quiet: () => null,
      });
    });

  cmd
    .command("status <domain>")
    .description("Check delegation status")
    .option("--json", "JSON output")
    .option("--quiet", "Quiet output (prints just the status)")
    .option("--wait", "Block until the domain becomes active")
    .option("--timeout <seconds>", "Wait timeout in seconds (default 1800 = 30 min)", "1800")
    .action(async (domain: string, flags: { json?: boolean; quiet?: boolean; wait?: boolean; timeout?: string }) => {
      const ap = await makeClient();
      const d = flags.wait
        ? await ap.domains.waitActive(domain, { timeoutMs: Number(flags.timeout) * 1000 })
        : await ap.domains.status(domain);
      emit(chooseMode(flags), d, {
        human: (d) => printDomainStatus(d),
        quiet: (d) => d.status,
      });
    });

  cmd
    .command("remove <domain>")
    .description("Remove a domain from your tenant")
    .action(async (domain: string) => {
      const ap = await makeClient();
      await ap.domains.remove(domain);
      ok(`Removed ${domain}`);
    });
}

function printDomainAdded(d: Domain): void {
  ok(`DNS zone created for ${colors.cyan(d.domain)}`);
  process.stdout.write(`  Status: ${formatStatus(d.status)}\n\n`);
  process.stdout.write(`  ${colors.bold("Set these nameservers at your registrar")} for ${d.domain}:\n`);
  for (const ns of d.nameservers) {
    process.stdout.write(`    ${colors.green(ns)}\n`);
  }
  process.stdout.write("\n  Propagation usually 5–30 minutes.\n");
  process.stdout.write(`  Check progress: ${colors.dim(`app domain status ${d.domain}`)}\n`);
}

function printDomainStatus(d: Domain): void {
  ok(d.status === "active" ? `${d.domain} is active.` : `${d.domain} is ${d.status}.`);
  kv([
    ["status", d.status],
    ["emailReady", String(d.emailReady)],
    ["nameservers", d.nameservers.join(", ")],
    ["createdAt", d.createdAt],
  ]);
}

function formatStatus(s: string): string {
  if (s === "active") return colors.green(s);
  if (s === "pending") return colors.yellow(s);
  return colors.red(s);
}
