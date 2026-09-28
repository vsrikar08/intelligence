import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.resolve(process.env.ROWBOAT_SOURCE_DIR || path.join(root, "rowboat"));
const renderer = path.join(source, "apps/x/apps/renderer");
// Serve the fork's existing interface; all state stays with the backend
// (2026-09-27, local intelligence conversation testing).
const child = spawn(
  process.execPath,
  [path.join(renderer, "node_modules/vite/bin/vite.js"), "--config", "browser.config.ts"],
  {
    cwd: renderer,
    env: {
      ...process.env,
      ROWBOAT_WORKDIR: path.join(root, ".local/intelligence"),
      VITE_PUBLIC_POSTHOG_KEY: ""
    },
    stdio: "inherit"
  }
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
