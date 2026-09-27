import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const [command, args] of [
  ['uv', ['run', '--locked', '--project', 'backend', 'uvicorn', 'app:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8000', '--workers', '1']],
  [process.execPath, ['node_modules/vinext/dist/cli.js', process.argv.includes('--production') ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', '3000']],
]) {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  children.push(child);
  child.on('error', () => { console.error(`Could not start ${command}. Check README setup requirements.`); stop(1); });
  child.on('exit', (code) => { if (!stopping) stop(code ?? 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
