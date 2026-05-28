import { Command } from "commander";
import { makeClient } from "../client.js";
import {
  chooseMode,
  emit,
  ok,
  info,
  kv,
  table,
  colors,
} from "../output.js";
import type { Inbox, InboundEmail } from "@agentpassportsh/sdk";

export function registerEmail(program: Command): void {
  const cmd = program.command("email").description("Inboxes — create, send, read, watch");

  cmd
    .command("create")
    .description("Provision a new inbox on a domain you own")
    .requiredOption("--domain <domain>", "domain to bind the inbox to")
    .option("--name <local>", "local part of the address (e.g. 'support')")
    .option("--json", "JSON output")
    .option("--quiet", "Quiet output (prints the address)")
    .action(async (flags: { domain: string; name?: string; json?: boolean; quiet?: boolean }) => {
      const ap = await makeClient();
      const inbox = await ap.email.create({
        domain: flags.domain,
        ...(flags.name !== undefined ? { name: flags.name } : {}),
      });
      emit(chooseMode(flags), inbox, {
        human: (i) => printInbox(i, true),
        quiet: (i) => i.address,
      });
    });

  cmd
    .command("list")
    .description("List inboxes")
    .option("--json", "JSON output")
    .action(async (flags: { json?: boolean }) => {
      const ap = await makeClient();
      const inboxes = await ap.email.list();
      emit(chooseMode(flags), inboxes, {
        human: (rows) => {
          if (rows.length === 0) {
            info("No inboxes yet. Try `app email create --domain <yourdomain.com>`.");
            return;
          }
          table(
            ["ADDRESS", "DOMAIN", "CREATED"],
            rows.map((i) => [i.address, i.domain, i.createdAt]),
          );
        },
        quiet: () => null,
      });
    });

  cmd
    .command("send")
    .description("Send an email from one of your inboxes")
    .requiredOption("--from <address>")
    .requiredOption("--to <address>")
    .requiredOption("--subject <subject>")
    .option("--body <text>", "plain-text body")
    .option("--json", "JSON output")
    .option("--quiet", "Quiet output (prints the message id)")
    .action(async (flags: { from: string; to: string; subject: string; body?: string; json?: boolean; quiet?: boolean }) => {
      const ap = await makeClient();
      const sendBody = flags.body ?? "";
      const result = await ap.email.send({
        from: flags.from,
        to: flags.to,
        subject: flags.subject,
        text: sendBody,
      });
      emit(chooseMode(flags), result, {
        human: (r) => ok(`Sent. Message id: ${colors.cyan(r.id)}`),
        quiet: (r) => r.id,
      });
    });

  cmd
    .command("read")
    .description("Read recent messages from an inbox (newest first)")
    .requiredOption("--inbox <address>")
    .option("--filter <text>", "filter messages whose raw content contains this substring")
    .option("-n, --limit <n>", "max messages to return", "20")
    .option("--json", "JSON output")
    .action(async (flags: { inbox: string; filter?: string; limit?: string; json?: boolean }) => {
      const ap = await makeClient();
      const params = {
        inbox: flags.inbox,
        limit: Number(flags.limit ?? 20),
        ...(flags.filter !== undefined ? { filter: flags.filter } : {}),
      };
      const messages = await ap.email.read(params);
      emit(chooseMode(flags), messages, {
        human: (msgs) => {
          if (msgs.length === 0) {
            info(`No messages in ${flags.inbox} yet.`);
            return;
          }
          for (const m of msgs) {
            process.stdout.write("\n");
            printEmail(m);
          }
        },
        quiet: () => null,
      });
    });

  cmd
    .command("watch")
    .description("Block until new email arrives, stream messages as they come in")
    .requiredOption("--inbox <address>")
    .option("--filter <text>", "only yield messages matching this filter")
    .option("--timeout <seconds>", "max seconds to wait", "60")
    .option("--json", "JSON output (NDJSON: one line per message)")
    .action(
      async (flags: {
        inbox: string;
        filter?: string;
        timeout?: string;
        json?: boolean;
      }) => {
        const ap = await makeClient();
        const timeoutMs = Number(flags.timeout ?? 60) * 1000;
        const mode = chooseMode(flags);

        const watchParams: {
          inbox: string;
          timeoutMs: number;
          filter?: string;
        } = { inbox: flags.inbox, timeoutMs };
        if (flags.filter !== undefined) watchParams.filter = flags.filter;

        if (mode === "human") info(`Waiting for new email at ${colors.cyan(flags.inbox)}…`);
        for await (const msg of ap.email.watch(watchParams)) {
          if (mode === "json") {
            process.stdout.write(JSON.stringify(msg) + "\n");
          } else if (mode === "quiet") {
            // Nothing — quiet has no obvious headline value for streaming
          } else {
            process.stdout.write("\n");
            printEmail(msg);
          }
        }
      },
    );
}

function printInbox(inbox: Inbox, created: boolean): void {
  if (created) ok(`Inbox created`);
  kv([
    ["address", inbox.address],
    ["domain", inbox.domain],
    ["createdAt", inbox.createdAt],
  ]);
}

function printEmail(m: InboundEmail): void {
  process.stdout.write(`${colors.green("✓")} New message\n`);
  kv([
    ["from", m.from || "(unknown)"],
    ["to", m.to],
    ["subject", m.subject || "(no subject)"],
    ["receivedAt", m.receivedAt],
    ...(m.sentAt ? [["sentAt", m.sentAt] as [string, string]] : []),
  ]);
  const body = m.text ?? m.html ?? "";
  if (body) {
    process.stdout.write("\n");
    // Soft preview cap to keep terminal output readable. Full body is
    // still on msg.text / msg.html / msg.raw for agents that need it.
    const preview = body.length > 800 ? body.slice(0, 800) + "\n…" : body;
    process.stdout.write(colors.dim(preview.replace(/\r\n/g, "\n")) + "\n");
  }
}
