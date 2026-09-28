import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
export const patchyDir = path.resolve(process.env.PATCHY_CLOUD_DIR || path.join(here, '../..'));

// Use Patchy's existing credential resolution and JSON contract (2026-09-27).
// Arguments are passed directly to Node; descriptions never become shell code.
export async function runPatchy(args) {
  const command = [
    '--import', path.join(patchyDir, 'node_modules/tsx/dist/loader.mjs'),
    '--conditions=development', path.join(patchyDir, 'packages/patchy/src/index.ts'),
    ...args,
  ];
  try {
    const { stdout } = await exec(process.execPath, command, {
      cwd: patchyDir,
      env: process.env,
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    let refusal;
    try { refusal = JSON.parse(error.stderr || error.stdout); } catch { /* Not a wire refusal. */ }
    if (refusal) throw new Error(JSON.stringify(refusal));
    // Do not return subprocess environment or credential-bearing diagnostics.
    throw new Error(error.killed
      ? 'Patchy did not finish in time. Read the current state before retrying a write.'
      : 'Patchy CLI failed. Check that the local Patchy instance is running and its CLI can authenticate.');
  }
}
