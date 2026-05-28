// Output formatters for three modes: human (default, ANSI colors), JSON, and
// quiet (single-line, just the most important value).
//
// Every command picks its own "headline value" for quiet mode, so this module
// gives them small primitives rather than a heavyweight printer.

import pc from "picocolors";

export type OutputMode = "human" | "json" | "quiet";

export interface OutputOptions {
  mode: OutputMode;
}

export function chooseMode(flags: { json?: boolean; quiet?: boolean }): OutputMode {
  if (flags.json) return "json";
  if (flags.quiet) return "quiet";
  return "human";
}

export function emit<T>(mode: OutputMode, data: T, opts: { human: (d: T) => void; quiet: (d: T) => string | null }): void {
  if (mode === "json") {
    process.stdout.write(JSON.stringify(data) + "\n");
    return;
  }
  if (mode === "quiet") {
    const line = opts.quiet(data);
    if (line !== null) process.stdout.write(line + "\n");
    return;
  }
  opts.human(data);
}

// ─── Human-mode primitives ──────────────────────────────────────────────────

export const colors = pc;

export function ok(label: string, body?: string): void {
  process.stdout.write(`${pc.green("✓")} ${label}${body ? "\n  " + body : ""}\n`);
}

export function info(line: string): void {
  process.stdout.write(`${pc.dim("›")} ${line}\n`);
}

export function dim(s: string): string {
  return pc.dim(s);
}

export function spinner(label: string): { stop: (finalLine?: string) => void } {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let active = process.stdout.isTTY;

  const handle = active
    ? setInterval(() => {
        process.stdout.write(`\r${pc.cyan(frames[i % frames.length]!)} ${label}`);
        i++;
      }, 80)
    : null;

  if (!active) process.stdout.write(`${pc.cyan("⏳")} ${label}\n`);

  return {
    stop(finalLine?: string) {
      if (handle) {
        clearInterval(handle);
        process.stdout.write("\r" + " ".repeat(label.length + 4) + "\r");
      }
      if (finalLine) process.stdout.write(finalLine + "\n");
      active = false;
    },
  };
}

/** Human-readable key/value list. */
export function kv(rows: Array<[string, string | number | undefined | null]>): void {
  const labelW = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) {
    if (v === undefined || v === null) continue;
    process.stdout.write(`  ${pc.dim((k + ":").padEnd(labelW + 1))} ${v}\n`);
  }
}

/** Pretty-print a header row. */
export function header(s: string): void {
  process.stdout.write(`${pc.bold(s)}\n`);
}

/** Simple bordered table. */
export function table(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const drawRow = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  process.stdout.write(pc.dim(drawRow(headers)) + "\n");
  for (const r of rows) process.stdout.write(drawRow(r) + "\n");
}
