import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchyDir, runPatchy } from './patchy-cli.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const workDir = path.resolve(process.env.ROWBOAT_WORKDIR || path.join(root, 'data/patchy-demo'));
const configDir = path.join(workDir, 'config');
await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
// Keep demo logins and publish recovery separate from personal CLI state.
process.env.PATCHY_STATE_DIR ??= path.join(workDir, 'patchy-cli');

const identity = await runPatchy(['whoami', '--json']);
console.log(`Patchy: ${identity.user.name} / ${identity.company.name} / ${identity.machine.name}`);

const demoConfigPath = path.join(configDir, 'patchy-demo.json');
let demo;
try { demo = JSON.parse(await fs.readFile(demoConfigPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!demo) {
  const listing = await runPatchy(['list', 'patches', '--json']);
  const existing = listing.patches.find(patch => patch.name === 'rowboat-demo' && patch.owner.id === identity.user.id);
  const published = existing ? { patchId: existing.id } : await runPatchy([
      'publish', path.join(here, 'patch.html'), '--name', 'rowboat-demo',
      '--description', 'A local assistant demo: discover patches, update a description, and remember work context.',
      '--json',
    ]);
  demo = { patchId: published.patchId, companyId: identity.company.id, userId: identity.user.id };
  if (!demo.patchId) throw new Error('Patchy publish did not return a patchId. Inspect the CLI publish result.');
  await fs.writeFile(demoConfigPath, JSON.stringify(demo, null, 2) + '\n', { mode: 0o600 });
}
if (demo.companyId !== identity.company.id || demo.userId !== identity.user.id) {
  throw new Error('This demo belongs to another Patchy user/company. Switch back before starting it.');
}
await runPatchy(['list', demo.patchId, '--json']);

const mcpPath = path.join(configDir, 'mcp.json');
let mcp = { mcpServers: {} };
try { mcp = JSON.parse(await fs.readFile(mcpPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
mcp.mcpServers['patchy'] = {
  command: process.execPath,
  args: [path.join(root, 'apps/x/packages/core/scripts/patchy-mcp.mjs')],
  env: {
    PATCHY_CLOUD_DIR: patchyDir,
    PATCHY_DEMO_PATCH_ID: demo.patchId,
    PATCHY_STATE_DIR: process.env.PATCHY_STATE_DIR,
  },
};
await fs.writeFile(mcpPath, JSON.stringify(mcp, null, 2) + '\n', { mode: 0o600 });
console.log(`Demo patch: ${demo.patchId}`);
console.log(`Rowboat data: ${workDir}`);
if (!process.argv.includes('--setup-only')) {
  console.log('Connection prepared. Start the self-hosted instance from patchy-cloud with: pnpm dev:intelligence');
}
