import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMemory } from '../lib/memory.ts';
const request = (text: unknown) => new Request('http://127.0.0.1:3000/api/remember', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' }, body: JSON.stringify({ text, user_id: 'untrusted-user' }) });
test('proxy calls only local backend and passes no caller identity or credentials', async () => {
  const mock = (async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:8000/api/remember');
    assert.deepEqual(JSON.parse(String(init?.body)), { text: 'Patchy uses Mem0' });
    assert.equal(new Headers(init?.headers).get('Authorization'), null);
    return Response.json({ memories: [{ id: '1', memory: 'Patchy uses Mem0' }], message: 'Saved' });
  }) as typeof fetch;
  const response = await handleMemory(request('  Patchy uses Mem0  '), 'remember', mock);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('rejects blank, oversized and cross-origin requests', async () => {
  for (const text of ['', '  ', 'a'.repeat(4001), 42]) assert.equal((await handleMemory(request(text), 'remember')).status, 400);
  const crossOrigin = request('hello'); crossOrigin.headers.set('Origin', 'https://other.example');
  assert.equal((await handleMemory(crossOrigin, 'recall')).status, 403);
});
test('reports backend setup errors and unavailable backend safely', async () => {
  const missingSetup = await handleMemory(request('hello'), 'recall', (async () => Response.json({ error: 'Run setup.' }, { status: 503 })) as typeof fetch);
  assert.equal(missingSetup.status, 503);
  const unavailable = await handleMemory(request('hello'), 'recall', (async () => { throw new Error('private provider details'); }) as typeof fetch);
  assert.equal(unavailable.status, 503);
  assert.ok(!(await unavailable.text()).includes('private provider details'));
});
test('Ask uses the same local proxy and preserves answer and cited memories', async () => {
  const payload = { answer: 'Alex handles security.', memories: [{ id: '1', memory: 'Alex handles security.' }], insufficient: false, message: 'Based on your saved notes.' };
  const response = await handleMemory(request('Who handles security?'), 'ask', (async (url) => {
    assert.equal(url, 'http://127.0.0.1:8000/api/ask');
    return Response.json(payload);
  }) as typeof fetch);
  assert.deepEqual(await response.json(), payload);
});
