// Minimal interactive prompts via node:readline. Used only by `app login`.
// Every other command is non-interactive by design.

import readline from "node:readline";

export function ask(question: string, opts: { mask?: boolean } = {}): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    if (opts.mask) {
      // Naive masking: hide echoed chars
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      stdin.setRawMode?.(true);
      const chunks: string[] = [];

      process.stdout.write(question);

      const onData = (buf: Buffer) => {
        const s = buf.toString("utf8");
        for (const ch of s) {
          if (ch === "\r" || ch === "\n") {
            stdin.removeListener("data", onData);
            stdin.setRawMode?.(wasRaw ?? false);
            process.stdout.write("\n");
            rl.close();
            resolve(chunks.join(""));
            return;
          }
          if (ch === "") {
            // Ctrl+C
            process.exit(130);
          }
          if (ch === "" || ch === "\b") {
            if (chunks.length > 0) {
              chunks.pop();
              process.stdout.write("\b \b");
            }
            continue;
          }
          chunks.push(ch);
          process.stdout.write("•");
        }
      };

      stdin.on("data", onData);
      stdin.resume();
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}
