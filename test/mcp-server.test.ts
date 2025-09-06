// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';

describe('SmartSuiteShimServer', () => {
  it('should be instantiable with proper MCP server interface', () => {
    expect(() => new SmartSuiteShimServer()).not.toThrow();
  });

  it('should register exactly 4 CQRS tools', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();

    expect(tools).toHaveLength(4);
    expect(tools.map((t: any) => t.name)).toEqual([
      'smartsuite_query',
      'smartsuite_record',
      'smartsuite_schema',
      'smartsuite_undo',
    ]);
  });

  it('should enforce mandatory dry-run pattern for record tool', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();
    const recordTool = tools.find((t: any) => t.name === 'smartsuite_record');

    expect((recordTool?.inputSchema?.properties?.dry_run as any)?.default).toBe(true);
  });

  it('should use enum constraints for operation parameters', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();

    const queryTool = tools.find((t: any) => t.name === 'smartsuite_query');
    expect((queryTool?.inputSchema?.properties?.operation as any)?.enum).toEqual([
      'list', 'get', 'search', 'count',
    ]);

    const recordTool = tools.find((t: any) => t.name === 'smartsuite_record');
    expect((recordTool?.inputSchema?.properties?.operation as any)?.enum).toEqual([
      'create', 'update', 'delete', 'bulk_update', 'bulk_delete',
    ]);
  });

  // NEW FAILING TESTS - These will fail until methods are implemented
  it('should have executeTool method', () => {
    const server = new SmartSuiteShimServer();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(server.executeTool).toBeDefined();
    expect(typeof server.executeTool).toBe('function');
  });

  it('should have authenticate method', () => {
    const server = new SmartSuiteShimServer();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(server.authenticate).toBeDefined();
    expect(typeof server.authenticate).toBe('function');
  });

  // TDD RED PHASE: Auto-authentication on startup test
  describe('auto-authentication behavior', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should auto-authenticate from environment variables on startup', async () => {
      // ARRANGE: Set up environment variables
      process.env.SMARTSUITE_API_TOKEN = 'test-api-token-12345';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';

      // ACT: Create server instance
      const server = new SmartSuiteShimServer();

      // ASSERT: Server should be authenticated without explicit authenticate() call
      // This test will FAIL initially because auto-authentication doesn't exist yet
      expect(server.isAuthenticated()).toBe(true);
    });

    it('should allow tool execution without explicit authenticate() call when env vars are set', async () => {
      // ARRANGE: Set up environment variables
      process.env.SMARTSUITE_API_TOKEN = 'test-api-token-12345';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';

      // ACT: Create server and try to execute tool
      const server = new SmartSuiteShimServer();

      // ASSERT: Tool execution should work without throwing "Authentication required" error
      // This test will FAIL initially because executeTool requires explicit authentication
      await expect(
        server.executeTool('smartsuite_schema', {
          appId: '6613bedd1889d8deeaef8b0e',
        }),
      ).resolves.not.toThrow('Authentication required: call authenticate() first');
    });

    it('should fallback to manual authentication when environment variables are missing', async () => {
      // ARRANGE: Clear environment variables
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // ACT: Create server instance
      const server = new SmartSuiteShimServer();

      // ASSERT: Server should not be auto-authenticated
      expect(server.isAuthenticated()).toBe(false);

      // ASSERT: Tool execution should still require explicit authentication
      await expect(
        server.executeTool('smartsuite_schema', {
          appId: '6613bedd1889d8deeaef8b0e',
        }),
      ).rejects.toThrow('Authentication required: call authenticate() first');
    });

    it('should prioritize environment variables over manual authentication config', async () => {
      // ARRANGE: Set up environment variables
      process.env.SMARTSUITE_API_TOKEN = 'env-api-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'env-workspace-id';

      const server = new SmartSuiteShimServer();

      // ACT: Try manual authentication with different values
      await server.authenticate({
        apiKey: 'manual-api-token',
        workspaceId: 'manual-workspace-id',
      });

      // ASSERT: Server should use environment variable values, not manual config
      // This test will FAIL initially because environment variable priority doesn't exist
      expect(server.getAuthConfig()).toEqual({
        apiKey: 'env-api-token',
        workspaceId: 'env-workspace-id',
      });
    });
  });
});
