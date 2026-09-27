// Server-only proxy to the local Python Mem0 OSS process. No hosted Mem0 API.
export async function handleMemory(request: Request, action: 'remember' | 'recall' | 'ask', upstream: typeof fetch = fetch): Promise<Response> {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Use this page to access memories.' }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Send a JSON request.' }, 415);
    if (Number(request.headers.get('content-length')) > 24000) return json({ error: 'Please keep your text under 4,000 characters.' }, 413);
    const raw = await request.text();
    if (raw.length > 24000) return json({ error: 'Please keep your text under 4,000 characters.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'The request was not valid JSON.' }, 400); }
    if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000) return json({ error: 'Enter between 1 and 4,000 characters.' }, 400);
    const response = await upstream(`http://127.0.0.1:8000/api/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body.text.trim() }), signal: AbortSignal.timeout(110000),
    });
    return json(await response.json(), response.status);
  } catch {
    return json({ error: 'The local memory backend is unavailable or took too long. Start it with npm run dev. Try Recall before saving again.' }, 503);
  }
}
