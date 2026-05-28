// Local CLI config at ~/.agentpassport/config.json. Holds the API key and a
// handful of user preferences. Created on first `app login`; never edited
// by hand normally — `app config set <k> <v>` is the proper interface.

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

export interface CliConfig {
  apiKey?: string;
  /** Override of the backend base URL. Useful for local dev / self-hosting. */
  baseUrl?: string;
  defaultCountry?: string;
}

const CONFIG_DIR = join(homedir(), ".agentpassport");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const VALID_KEYS = ["apiKey", "baseUrl", "defaultCountry"] as const;
export type ConfigKey = (typeof VALID_KEYS)[number];

export function configPath(): string {
  return CONFIG_PATH;
}

export async function readConfig(): Promise<CliConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as CliConfig;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") return {};
    throw err;
  }
}

export async function writeConfig(cfg: CliConfig): Promise<void> {
  await fs.mkdir(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  if (!isValidKey(key)) {
    throw new Error(`Unknown config key: ${key}. Valid keys: ${VALID_KEYS.join(", ")}`);
  }
  const cfg = await readConfig();
  cfg[key] = value;
  await writeConfig(cfg);
}

export async function getConfigValue(key: string): Promise<string | undefined> {
  if (!isValidKey(key)) {
    throw new Error(`Unknown config key: ${key}. Valid keys: ${VALID_KEYS.join(", ")}`);
  }
  const cfg = await readConfig();
  return cfg[key];
}

function isValidKey(key: string): key is ConfigKey {
  return (VALID_KEYS as readonly string[]).includes(key);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
