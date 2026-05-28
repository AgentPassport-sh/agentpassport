import { Command } from "commander";
import { readConfig, writeConfig, configPath } from "../config.js";
import { ask } from "../prompt.js";
import { ok, info, colors } from "../output.js";

export function registerLogin(program: Command): void {
  program
    .command("login")
    .description("Paste an API key and save it to ~/.agentpassport/config.json")
    .option("--key <key>", "non-interactive: pass the key directly")
    .action(async (opts: { key?: string }) => {
      const cfg = await readConfig();
      info(`Get your API key at ${colors.cyan("https://agentpassport.sh/dashboard")}.`);
      const key = opts.key ?? (await ask("Paste API key: ", { mask: true }));
      if (!key.trim()) {
        process.stderr.write("Empty key, aborting.\n");
        process.exit(1);
      }
      if (!key.startsWith("ap_")) {
        process.stderr.write(
          `Warning: keys normally start with "ap_live_" or "ap_test_". Saved anyway.\n`,
        );
      }
      cfg.apiKey = key.trim();
      await writeConfig(cfg);
      ok(`Saved API key to ${configPath()}`);
    });
}
