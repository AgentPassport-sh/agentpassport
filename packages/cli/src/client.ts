import { AgentPassport, AgentPassportOptions } from "@agentpassportsh/sdk";
import { readConfig } from "./config.js";

const ENV_API_KEY = "AP_API_KEY";
const ENV_BASE_URL = "AP_BASE_URL";

/**
 * Build an SDK client from CLI config + env. Resolution order for each field:
 *   env > config file > SDK default
 *
 * Throws a friendly error if no API key is configured.
 */
export async function makeClient(): Promise<AgentPassport> {
  const cfg = await readConfig();
  const apiKey = process.env[ENV_API_KEY] ?? cfg.apiKey;
  if (!apiKey) {
    throw new Error(
      "No API key configured. Run `app login` or set AP_API_KEY env variable.",
    );
  }
  const baseUrl = process.env[ENV_BASE_URL] ?? cfg.baseUrl;
  const options: AgentPassportOptions = { apiKey };
  if (baseUrl) options.baseUrl = baseUrl;
  return new AgentPassport(options);
}
