// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';
import { SmartSuiteShimServer } from '../src/mcp-server';

describe('SmartSuiteShimServer', () => {
  it('should be instantiable with proper MCP server interface', () => {
    expect(() => new SmartSuiteShimServer()).not.toThrow();
  });

  it('should register exactly 4 CQRS tools', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();
    
    expect(tools).toHaveLength(4);
    expect(tools.map(t => t.name)).toEqual([
      'smartsuite_query',
      'smartsuite_record', 
      'smartsuite_schema',
      'smartsuite_undo'
    ]);
  });

  it('should enforce mandatory dry-run pattern for record tool', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();
    const recordTool = tools.find(t => t.name === 'smartsuite_record');
    
    expect(recordTool?.inputSchema?.properties?.dry_run?.default).toBe(true);
  });

  it('should use enum constraints for operation parameters', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();
    
    const queryTool = tools.find(t => t.name === 'smartsuite_query');
    expect(queryTool?.inputSchema?.properties?.operation?.enum).toEqual([
      'list', 'get', 'search', 'count'
    ]);

    const recordTool = tools.find(t => t.name === 'smartsuite_record');
    expect(recordTool?.inputSchema?.properties?.operation?.enum).toEqual([
      'create', 'update', 'delete', 'bulk_update', 'bulk_delete'
    ]);
  });
});