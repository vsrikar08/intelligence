import fs from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.resolve(process.env.ROWBOAT_SOURCE_DIR || path.join(root, "rowboat"));
const workDir = path.join(root, ".local/intelligence");
const stateFile = path.join(workDir, "instance.json");
const logFile = path.join(workDir, "rowboat.log");
const command = process.argv[2] || "start";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
async function birth(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    return (await exec("ps", ["-p", String(pid), "-o", "lstart="])).stdout.trim() || null;
  } catch {
    return null;
  }
}
const alive = async (state) => Boolean(state?.birth && (await birth(state.pid)) === state.birth);
async function healthy(url) {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok && (await response.json()).name === "rowboat-server";
  } catch {
    return false;
  }
}
let recorded;
try {
  recorded = await readJson(stateFile);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const running = await alive(recorded);
const ready = running && (await healthy(recorded.url));
if (command === "status") {
  console.log(JSON.stringify({ ...recorded, running, healthy: ready }, null, 2));
  process.exit(ready ? 0 : 1);
}
if (command === "stop") {
  if (!running) {
    console.log("Intelligence is not running.");
    process.exit(0);
  }
  process.kill(recorded.pid, "SIGTERM");
  for (let attempt = 0; attempt < 40; attempt++) {
    if (!(await alive(recorded))) {
      console.log("Intelligence stopped. Data and settings are preserved.");
      process.exit(0);
    }
    await sleep(250);
  }
  throw new Error(`The instance is still shutting down. See ${logFile}`);
}
if (command === "rpc") {
  if (!ready) throw new Error("Start the local instance with pnpm dev:intelligence first.");
  const channel = process.argv[3];
  if (!channel || !/^[a-zA-Z0-9:_-]+$/.test(channel))
    throw new Error("Supply an RPC channel and optional JSON input.");
  const input = JSON.parse(process.argv[4] || "null");
  const key = (await fs.readFile(path.join(workDir, "server-key"), "utf8")).trim();
  const response = await fetch(`${recorded.url}/rpc/${channel}`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(60000)
  });
  console.log(JSON.stringify(await response.json(), null, 2));
  process.exit(response.ok ? 0 : 1);
}
if (command !== "start") throw new Error("Use pnpm dev:intelligence [start|status|stop|rpc].");
if (ready) {
  console.log(`Local Rowboat service is already running: ${recorded.url}`);
  process.exit(0);
}
if (running)
  throw new Error(
    `The instance is running but unhealthy. See ${logFile}; use dev:intelligence stop before restarting.`
  );
await fs.access(path.join(source, "apps/x/apps/server/dist/standalone.js")).catch(() => {
  throw new Error(
    `Build the Rowboat checkout at ${source} first. See docs/DEVELOPMENT.md, Local intelligence.`
  );
});
await fs.mkdir(workDir, { recursive: true, mode: 0o700 });

// Serialize launchers and identify processes by start time so stale state cannot
// stop an unrelated process after PID reuse (2026-09-27, local integration).
const lockPath = path.join(workDir, "launcher.lock");
let lock;
try {
  lock = await fs.open(lockPath, "wx", 0o600);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  const owner = await readJson(lockPath);
  if (await alive(owner)) throw new Error("Another intelligence launcher is running.");
  await fs.unlink(lockPath);
  lock = await fs.open(lockPath, "wx", 0o600);
}
await lock.writeFile(JSON.stringify({ pid: process.pid, birth: await birth(process.pid) }));
try {
  // Reuse Patchy's dev runner and identity rather than introducing a second
  // credential or changing production authentication (2026-09-27).
  const cli = [
    "--import",
    path.join(root, "node_modules/tsx/dist/loader.mjs"),
    "--conditions=development"
  ];
  const dev = await exec(
    process.execPath,
    [...cli, path.join(root, "scripts/dev/src/main.ts"), "--json"],
    { cwd: root, timeout: 120000 }
  );
  const patchy = JSON.parse(dev.stdout);
  const env = {
    ...process.env,
    ROWBOAT_WORKDIR: workDir,
    PATCHY_CLOUD_DIR: root,
    PATCHY_STATE_DIR: path.join(workDir, "patchy-cli"),
    ROWBOAT_LOCAL_ONLY: "1"
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ROWBOAT_PARENT_PID;
  delete env.POSTHOG_KEY;
  delete env.VITE_PUBLIC_POSTHOG_KEY;
  await exec(process.execPath, [path.join(source, "demo/start.mjs"), "--setup-only"], {
    cwd: root,
    env,
    timeout: 120000
  });
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  env.ROWBOAT_SERVER_PORT = String(port);
  env.API_URL = `${url}/hosted-services-disabled`;
  const log = openSync(logFile, "a", 0o600);
  const child = spawn(
    process.execPath,
    [path.join(source, "apps/x/apps/server/dist/standalone.js")],
    {
      cwd: path.join(source, "apps/x"),
      env,
      detached: true,
      stdio: ["ignore", log, log]
    }
  );
  closeSync(log);
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
  const state = {
    url,
    workDir,
    source,
    logFile,
    patchyUrl: patchy.apiUrl,
    pid: child.pid,
    birth: await birth(child.pid)
  };
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await healthy(url)) {
      console.log(
        `Local Rowboat service: ${url}\nPatchy Cloud: ${patchy.apiUrl}\nData: ${workDir}\nLogs: ${logFile}\nStatus: pnpm dev:intelligence status\nStop: pnpm dev:intelligence stop`
      );
      process.exitCode = 0;
      break;
    }
    if (!(await alive(state))) throw new Error(`Rowboat exited. See ${logFile}`);
    if (attempt === 119) {
      process.kill(child.pid, "SIGTERM");
      throw new Error(`Rowboat did not become healthy. See ${logFile}`);
    }
    await sleep(500);
  }
} finally {
  await lock.close();
  await fs.unlink(lockPath);
}
