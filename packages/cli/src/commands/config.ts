import { Command } from "commander";
import { getConfigValue, setConfigValue, readConfig } from "../config.js";
import { kv } from "../output.js";

export function registerConfig(program: Command): void {
  const cmd = program.command("config").description("Manage local CLI configuration");

  cmd
    .command("get <key>")
    .description("Print a config value")
    .action(async (key: string) => {
      const val = await getConfigValue(key);
      if (val === undefined) {
        process.stderr.write(`(unset)\n`);
        process.exit(1);
      }
      process.stdout.write(val + "\n");
    });

  cmd
    .command("set <key> <value>")
    .description("Set a config value")
    .action(async (key: string, value: string) => {
      await setConfigValue(key, value);
      process.stdout.write(`✓ ${key} = ${value}\n`);
    });

  cmd
    .command("list")
    .description("Print the full config")
    .action(async () => {
      const cfg = await readConfig();
      kv([
        ["apiKey", cfg.apiKey ? cfg.apiKey.slice(0, 12) + "…" : undefined],
        ["baseUrl", cfg.baseUrl],
        ["defaultCountry", cfg.defaultCountry],
      ]);
    });
}
