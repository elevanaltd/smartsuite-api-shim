// Context7: consulted for vitest
// TESTGUARD-APPROVED: CI-ERROR-FIX-002 - Fixing tool registry initialization in test setup
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';

describe('MCP Server Table Resolution', () => {
  let server: SmartSuiteShimServer;

  beforeEach(async () => {
    // Technical-Architect: Enable test mode to ensure all 9 tools are available
    // TESTGUARD: TEST_MODE removed - production parity enforced
    server = new SmartSuiteShimServer();
    // Mock environment variables for authentication
    process.env.SMARTSUITE_API_TOKEN = 'test-token';
    process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';

    // Mock the authenticate method to avoid real API calls
    server['authenticate'] = vi.fn().mockResolvedValue(undefined);

    // Initialize the server which registers tools
    await server.initialize();

    // Initialize field mappings to enable table resolution
    await server['initializeFieldMappings']();
  });
  describe('Table name resolution in query operations', () => {
    it('should resolve table names to IDs in smartsuite_query', async () => {
      // Mock the client to avoid actual API calls
      const mockClient = {
        listRecords: vi.fn().mockResolvedValue({ items: [], total_count: 0 }),
      };
      server['client'] = mockClient as any;
      server['fieldMappingsInitialized'] = true;

      // Call with table name instead of ID
      await server.executeTool('smartsuite_intelligent', {
        tool_name: 'smartsuite_query',
        operation_description: 'list records from projects table',
        operation: 'list',
        appId: 'projects', // Table name instead of hex ID
        limit: 5,
      });

      // Should have called the client with resolved ID
      expect(mockClient.listRecords).toHaveBeenCalledWith(
        '68a8ff5237fde0bf797c05b3', // Expected resolved ID
        expect.any(Object),
      );
    });

    it('should work with existing hex IDs unchanged', async () => {
      const mockClient = {
        listRecords: vi.fn().mockResolvedValue({ items: [], total_count: 0 }),
      };
      server['client'] = mockClient as any;
      server['fieldMappingsInitialized'] = true;

      const hexId = '68a8ff5237fde0bf797c05b3';
      await server.executeTool('smartsuite_intelligent', {
        tool_name: 'smartsuite_query',
        operation_description: 'list records with hex ID',
        operation: 'list',
        appId: hexId,
        limit: 5,
      });

      expect(mockClient.listRecords).toHaveBeenCalledWith(hexId, expect.any(Object));
    });

    it('should provide helpful error for unknown table names', async () => {
      server['client'] = {} as any;
      server['fieldMappingsInitialized'] = true;

      await expect(
        server.executeTool('smartsuite_intelligent', {
          tool_name: 'smartsuite_query',
          operation_description: 'list records from unknown table',
          operation: 'list',
          appId: 'unknown_table',
          limit: 5,
        }),
      ).rejects.toThrow(/Unknown table 'unknown_table'/);
    });
  });

  describe('Discovery tool', () => {
    it('should list available tables', async () => {
      // Mock authentication to avoid 'Authentication required' error
      server['client'] = {} as any;

      const result = await server.executeTool('smartsuite_intelligent', {
        tool_name: 'smartsuite_discover',
        operation_description: 'discover available tables',
        scope: 'tables',
      });

      expect(result).toHaveProperty('tables');
      expect(Array.isArray((result as any).tables)).toBe(true);
      expect((result as any).tables.length).toBeGreaterThan(0);
      expect((result as any).tables[0]).toHaveProperty('name');
      expect((result as any).tables[0]).toHaveProperty('id');
      expect((result as any).tables[0]).toHaveProperty('solutionId');
    });

    it('should list fields for a specific table', async () => {
      // Mock authentication to avoid 'Authentication required' error
      server['client'] = {} as any;

      const result = await server.executeTool('smartsuite_intelligent', {
        tool_name: 'smartsuite_discover',
        operation_description: 'discover fields for projects table',
        scope: 'fields',
        tableId: 'projects', // Can use table name
      });

      expect(result).toHaveProperty('table');
      expect(result).toHaveProperty('fields');
      expect((result as any).table.name).toBe('projects');
      expect((result as any).fields).toHaveProperty('projectName');
      expect((result as any).fields.projectName).toBe('project_name_actual');
    });

    it('should work with table ID for fields discovery', async () => {
      // Mock authentication to avoid 'Authentication required' error
      server['client'] = {} as any;

      const result = await server.executeTool('smartsuite_intelligent', {
        tool_name: 'smartsuite_discover',
        operation_description: 'discover fields using hex ID',
        scope: 'fields',
        tableId: '68a8ff5237fde0bf797c05b3', // Using hex ID
      });

      expect((result as any).table.name).toBe('projects');
    });
  });

  describe('getTools', () => {
    it('should include smartsuite_discover tool', async () => {
      // Technical-Architect: In test mode, discover tool should be available
      // TESTGUARD: TEST_MODE removed - production parity enforced
      const testServer = new SmartSuiteShimServer();
      await testServer.initialize();
      const tools = testServer.getTools();
      const discoverTool = tools.find((t) => t.name === 'smartsuite_intelligent');

      expect(discoverTool).toBeDefined();
      expect(discoverTool?.description).toContain('Unified SmartSuite operations interface');
      expect(discoverTool?.inputSchema.properties).toHaveProperty('tool_name');
      expect(discoverTool?.inputSchema.properties).toHaveProperty('operation_description');
    });
  });
});
