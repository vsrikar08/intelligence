'use client';
import { useEffect, useRef } from 'react';
type Action = 'remember' | 'recall';
type Tool = {
  name: string; description: string; inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => Promise<unknown>;
};
// Optional browser capability; no dependency on WebMCP for normal use.
export function useMemoryTools(run: (action: Action, text: string) => Promise<unknown>) {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    for (const action of ['remember', 'recall'] as const) {
      try {
        void Promise.resolve(context.registerTool({
          name: action === 'remember' ? 'save_memory' : 'search_memories',
          description: action === 'remember' ? 'Save text to the fixed Patchy demo user’s Mem0 memory and show the result.' : 'Search the fixed Patchy demo user’s memories and show related results.',
          inputSchema: { type: 'object', properties: { text: { type: 'string', minLength: 1, maxLength: 4000 } }, required: ['text'], additionalProperties: false },
          annotations: { readOnlyHint: action === 'recall', untrustedContentHint: true },
          execute: async (input) => {
            const text = input && typeof input === 'object' && 'text' in input ? input.text : undefined;
            if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new Error('Enter 1–4,000 characters.');
            return latest.current(action, text.trim());
          },
        }, { signal: lifecycle.signal })).catch(() => { /* Optional API unavailable. */ });
      } catch { /* Optional API unavailable. */ }
    }
    return () => lifecycle.abort();
  }, []);
}
