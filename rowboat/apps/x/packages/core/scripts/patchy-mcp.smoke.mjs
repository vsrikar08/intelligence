import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Explicit local smoke check: only the dedicated demo description is changed,
// and its original text is restored even when a verification fails.
const configFile = process.env.ROWBOAT_WORKDIR
  ? path.join(process.env.ROWBOAT_WORKDIR, 'config/mcp.json')
  : new URL('../../../../../data/patchy-demo/config/mcp.json', import.meta.url);
const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
const connection = config.mcpServers.patchy;
const client = new Client({ name: 'patchy-demo-check', version: '0.1.0' });
const transport = new StdioClientTransport(connection);
const value = (response) => {
  assert.notEqual(response.isError, true, JSON.stringify(response.content));
  return JSON.parse(response.content.find((item) => item.type === 'text').text);
};
const call = async (name, args = {}) => client.callTool({ name, arguments: args });
let original;
let changed = false;
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'patchy_get_patch', 'patchy_identity', 'patchy_list_patches', 'patchy_update_demo_description',
  ]);
  const identity = value(await call('patchy_identity'));
  const id = identity.writableDemoPatchId;
  assert.equal(id, connection.env.PATCHY_DEMO_PATCH_ID);
  const listing = value(await call('patchy_list_patches'));
  assert.ok(listing.patches.some((patch) => patch.id === id));
  original = value(await call('patchy_get_patch', { patch: id }));
  assert.equal(original.name, 'rowboat-demo');
  assert.equal(original.owner.id, identity.identity.user.id);
  const description = '--demo smoke check: "a real Patchy update"';
  // A timeout can mean the write landed, so always attempt restoration after
  // issuing the mutation, not just after receiving success.
  changed = true;
  value(await call('patchy_update_demo_description', { description }));
  const updated = value(await call('patchy_get_patch', { patch: id }));
  assert.equal(updated.description, description);
  assert.equal(updated.currentVersion, original.currentVersion);
  const rejected = await call('patchy_update_demo_description', { description: 'x'.repeat(501) });
  assert.equal(rejected.isError, true);
  assert.equal(value(await call('patchy_get_patch', { patch: id })).description, description);
  console.log('PASS: MCP discovery, authenticated reads, real description update, literal CLI arguments, unchanged version, and invalid-write refusal.');
} finally {
  try {
    if (changed && original) {
      value(await call('patchy_update_demo_description', { description: original.description }));
      const restored = value(await call('patchy_get_patch', { patch: original.id }));
      assert.equal(restored.description, original.description);
      console.log('PASS: original demo description restored.');
    }
  } finally { await client.close(); }
}
