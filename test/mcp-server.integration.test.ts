// TESTGUARD: Production parity integration test - validates 2-tool interface
// Context7: consulted for vitest
// Technical-Architect: Testing actual production configuration
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';

import { setupTestAuthentication, isRealAuthAvailable, describeWithAuth } from './helpers/auth-setup.js';

// Set up test authentication before all tests
beforeAll(() => {
  setupTestAuthentication();
});

describe('SmartSuiteShimServer - Production Parity Tests', () => {
  it('should be instantiable with proper MCP server interface', () => {
    expect(() => new SmartSuiteShimServer()).not.toThrow();
  });

  describe('Sentinel Architecture (Production Configuration)', () => {
    it('should register exactly 2 tools in production mode', async () => {
      const server = new SmartSuiteShimServer();
      await server.initialize();
      const tools = await server.getTools();

      // CONTRACT: Production system exposes exactly 2 tools
      expect(tools).toHaveLength(2);
      expect(tools.map((t: any) => t.name)).toEqual([
        'smartsuite_intelligent',
        'smartsuite_undo',
      ]);
    });

    it('should route all operations through intelligent facade', async () => {
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // CONTRACT: The facade tool should handle all operation types
      const tools = await server.getTools();
      const facadeTool = tools.find((t: any) => t.name === 'smartsuite_intelligent');

      expect(facadeTool).toBeDefined();
      expect(facadeTool.description).toContain('Unified SmartSuite operations interface');
    });

    it('should provide undo capability as second tool', async () => {
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // CONTRACT: Undo tool must be available for transaction reversal
      const tools = await server.getTools();
      const undoTool = tools.find((t: any) => t.name === 'smartsuite_undo');

      expect(undoTool).toBeDefined();
      expect(undoTool.description).toContain('Undo a previous SmartSuite operation');
    });
  });

  describe('Facade Routing Validation', () => {
    let server: SmartSuiteShimServer;

    beforeEach(async () => {
      server = new SmartSuiteShimServer();
      await server.initialize();
    });

    it('should reject requests for non-existent individual tools', async () => {
      // CONTRACT: Individual tools should not be accessible
      const individualTools = [
        'smartsuite_query',
        'smartsuite_record',
        'smartsuite_schema',
        'smartsuite_discover',
      ];

      for (const toolName of individualTools) {
        await expect(
          server.executeTool(toolName, {}),
        ).rejects.toThrow(`Unknown tool: ${toolName}`);
      }
    });

    it('should route query operations through the facade', async () => {
      // Skip if no auth available
      if (!isRealAuthAvailable()) {
        return;
      }

      const queryRequest = {
        operation_description: 'list records from a table',
        tableId: '68ab34b30b1e05e11a8ba87f', // Test table
        method: 'GET',
      };

      // This will fail until facade routing is properly implemented
      // That's the CONTRACT we're defining
      const result = await server.executeTool('smartsuite_intelligent', queryRequest);
      expect(result).toBeDefined();
    });

    it('should route record operations through the facade', async () => {
      // Skip if no auth available
      if (!isRealAuthAvailable()) {
        return;
      }

      const createRequest = {
        operation_description: 'create a new record',
        tableId: '68ab34b30b1e05e11a8ba87f',
        mode: 'dry_run',
        payload: {
          title: 'Test Record',
        },
      };

      // CONTRACT: Create operations must route through facade
      const result = await server.executeTool('smartsuite_intelligent', createRequest);
      expect(result).toBeDefined();
    });
  });

  describe('Authentication Handling', () => {
    it('should handle authentication when credentials are available', async () => {
      if (!isRealAuthAvailable()) {
        // Skip if no real auth available
        return;
      }

      const server = new SmartSuiteShimServer();
      await server.initialize();

      expect(server.isAuthenticated()).toBe(true);
    });

    it('should start unauthenticated when SKIP_AUTO_AUTH is set', async () => {
      process.env.SKIP_AUTO_AUTH = 'true';

      const server = new SmartSuiteShimServer();
      await server.initialize();

      expect(server.isAuthenticated()).toBe(false);

      delete process.env.SKIP_AUTO_AUTH;
    });
  });
});
