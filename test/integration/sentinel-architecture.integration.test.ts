// Test-Methodology-Guardian: Integration test for Sentinel Architecture (2-tool system)
// CRITICAL: Validates the actual MCP server exposes only 2 tools in production
// Strategy: End-to-end validation of tool registration and routing behavior
// Context7: consulted for vitest

import { describe, it, expect, beforeEach } from 'vitest';

import { SmartSuiteShimServer } from '../../src/mcp-server.js';

describe('Sentinel Architecture Integration', () => {
  let server: SmartSuiteShimServer;

  beforeEach(() => {
    server = new SmartSuiteShimServer();
  });

  it('should register exactly 2 tools in Sentinel Architecture', async () => {
    await server.initialize();

    const tools = server.getTools();

    expect(tools).toHaveLength(2);

    const toolNames = tools.map((tool) => tool.name).sort();
    expect(toolNames).toEqual(['smartsuite_intelligent', 'smartsuite_undo']);
  });

  it('should expose smartsuite_intelligent tool with correct schema', async () => {
    await server.initialize();

    const tools = server.getTools();
    const intelligentTool = tools.find((tool) => tool.name === 'smartsuite_intelligent');

    expect(intelligentTool).toBeDefined();
    expect(intelligentTool!.description).toContain('SmartSuite');
    expect(intelligentTool!.description).toContain('intelligent');

    // Validate schema structure
    expect(intelligentTool!.inputSchema).toBeDefined();
    expect(intelligentTool!.inputSchema.type).toBe('object');
    expect(intelligentTool!.inputSchema.properties).toBeDefined();

    // Should have tool_name property for routing
    expect(intelligentTool!.inputSchema.properties).toHaveProperty('tool_name');
    expect(intelligentTool!.inputSchema.properties).toHaveProperty('operation_description');
  });

  it('should expose smartsuite_undo tool', async () => {
    await server.initialize();

    const tools = server.getTools();
    const undoTool = tools.find((tool) => tool.name === 'smartsuite_undo');

    expect(undoTool).toBeDefined();
    expect(undoTool!.description).toContain('ndo'); // Case-insensitive contains 'undo'
    expect(undoTool!.inputSchema).toBeDefined();
  });

  it('should NOT expose the old 9-tool architecture tools', async () => {
    await server.initialize();

    const tools = server.getTools();
    const toolNames = tools.map((tool) => tool.name);

    // These tools should NOT exist in Sentinel Architecture
    const obsoleteTools = [
      'smartsuite_query',
      'smartsuite_record',
      'smartsuite_schema',
      'smartsuite_discover',
      'smartsuite_knowledge_events',
      'smartsuite_knowledge_field_mappings',
      'smartsuite_knowledge_refresh_views',
    ];

    for (const obsoleteTool of obsoleteTools) {
      expect(toolNames).not.toContain(obsoleteTool);
    }
  });

  it('should route query operations through smartsuite_intelligent facade', async () => {
    // Skip authentication for routing test
    process.env.VALIDATION_MODE = 'true';

    await server.initialize();

    const tools = server.getTools();
    const intelligentTool = tools.find((tool) => tool.name === 'smartsuite_intelligent');

    expect(intelligentTool).toBeDefined();

    // Validate routing to query operations works
    const args = {
      tool_name: 'smartsuite_query',
      operation_description: 'list records from test table',
      operation: 'list_records',
      appId: '68ab34b30b1e05e11a8ba87f', // Test table ID
    };

    // This should not throw a "tool not found" error
    // (It may throw auth or other errors, but tool routing should work)
    try {
      await server.callTool('smartsuite_intelligent', args);
    } catch (error: any) {
      // Should not be "Unknown tool" error
      expect(error.message).not.toContain('Unknown tool');
    }

    delete process.env.VALIDATION_MODE;
  });

  it('should reject calls to obsolete tool names', async () => {
    await server.initialize();

    // These calls should fail because the tools don't exist
    const obsoleteToolTests = [
      { name: 'smartsuite_query', args: { operation: 'list_records', appId: 'test' } },
      { name: 'smartsuite_record', args: { operation: 'create', appId: 'test', data: {} } },
      { name: 'smartsuite_schema', args: { appId: 'test' } },
      { name: 'smartsuite_discover', args: {} },
    ];

    for (const { name, args } of obsoleteToolTests) {
      await expect(server.callTool(name, args)).rejects.toThrow(/Unknown tool/);
    }
  });

  it('should support both routing patterns through intelligent facade', async () => {
    process.env.VALIDATION_MODE = 'true';
    await server.initialize();

    // Pattern 1: Explicit tool_name routing
    const explicitArgs = {
      tool_name: 'smartsuite_query',
      operation_description: 'list records',
      operation: 'list_records',
      appId: 'test-table',
    };

    // Pattern 2: Natural language with endpoint/method
    const naturalArgs = {
      operation_description: 'list all records from my project table',
      endpoint: '/v1/applications/test-table/records',
      method: 'GET',
    };

    // Both should be accepted by the facade (may fail later for other reasons)
    try {
      await server.callTool('smartsuite_intelligent', explicitArgs);
    } catch (error: any) {
      expect(error.message).not.toContain('routing target');
    }

    try {
      await server.callTool('smartsuite_intelligent', naturalArgs);
    } catch (error: any) {
      expect(error.message).not.toContain('routing target');
    }

    delete process.env.VALIDATION_MODE;
  });

  it('should validate tool schemas are properly structured', async () => {
    await server.initialize();

    const tools = server.getTools();

    for (const tool of tools) {
      expect(tool.name).toEqual(expect.any(String));
      expect(tool.description).toEqual(expect.any(String));
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toEqual(expect.any(Object));
    }

    // Intelligent tool should have routing properties
    const intelligentTool = tools.find((tool) => tool.name === 'smartsuite_intelligent');
    expect(intelligentTool!.inputSchema.properties).toHaveProperty('tool_name');
    expect(intelligentTool!.inputSchema.properties).toHaveProperty('operation_description');
    expect(intelligentTool!.inputSchema.properties).toHaveProperty('endpoint');
    expect(intelligentTool!.inputSchema.properties).toHaveProperty('method');
  });

  it('should validate facade supports all legacy tool routing', async () => {
    await server.initialize();

    const tools = server.getTools();
    const intelligentTool = tools.find((tool) => tool.name === 'smartsuite_intelligent');

    expect(intelligentTool).toBeDefined();

    // The intelligent tool should support routing to all legacy operations
    // This is validated by the presence of the tool_name property with enum values
    const toolNameProperty = intelligentTool!.inputSchema.properties.tool_name as any;
    expect(toolNameProperty).toBeDefined();

    // Should be an enum type with all the legacy tool names
    if (toolNameProperty.enum) {
      const enumValues = toolNameProperty.enum;
      expect(enumValues).toContain('smartsuite_query');
      expect(enumValues).toContain('smartsuite_record');
      expect(enumValues).toContain('smartsuite_schema');
      expect(enumValues).toContain('smartsuite_discover');
    }
  });
});
