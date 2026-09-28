import { describe, expect, it, vi } from 'vitest';
const executeTool = vi.hoisted(() => vi.fn());
vi.mock('../../../mcp/mcp.js', () => ({ executeTool, listServers: vi.fn(), listTools: vi.fn() }));
vi.mock('../../../di/container.js', () => ({ default: { resolve: vi.fn() } }));
import { mcpTools } from './mcp.js';

describe('MCP execution reporting', () => {
    it('preserves a server refusal as a failure for the assistant', async () => {
        const refusal = { isError: true, content: [{ type: 'text', text: 'Only the demo patch can be changed.' }] };
        executeTool.mockResolvedValueOnce(refusal);
        const result = await mcpTools.executeMcpTool.execute({ serverName: 'patchy', toolName: 'update', arguments: {} });
        expect(result).toMatchObject({ success: false, result: refusal });
        expect(result.message).not.toContain('Successfully');
    });
    it('reports a successful tool result without losing its content', async () => {
        const success = { content: [{ type: 'text', text: '{"updated":true}' }] };
        executeTool.mockResolvedValueOnce(success);
        const result = await mcpTools.executeMcpTool.execute({ serverName: 'patchy', toolName: 'update', arguments: {} });
        expect(result).toMatchObject({ success: true, result: success });
    });
});
