// Critical-Engineer: consulted for build artifact verification strategy
// Context7: consulted for vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SmartSuiteShimServer } from '../build/src/mcp-server.js';

describe('Build Artifact Verification', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Auto-authentication behavior in built JavaScript', () => {
    it('should auto-authenticate when environment variables are present', () => {
      // Spy on the initialize method
      const tryAutoAuthSpy = vi.spyOn(SmartSuiteShimServer.prototype as any, 'initialize');
      
      // Set mock environment variables
      process.env.SMARTSUITE_API_TOKEN = 'mock-test-token-for-build-verification';
      process.env.SMARTSUITE_WORKSPACE_ID = 'mock-test-workspace-for-build-verification';

      // Instantiate the server
      const server = new SmartSuiteShimServer();

      // Verify initialize was called during construction
      expect(tryAutoAuthSpy).toHaveBeenCalledTimes(1);

      // Verify the server recognizes it should be authenticated
      expect(server.isAuthenticated()).toBe(true);

      // Verify auth config was populated from environment
      const authConfig = server.getAuthConfig();
      expect(authConfig).toBeDefined();
      expect(authConfig?.apiKey).toBe('mock-test-token-for-build-verification');
      expect(authConfig?.workspaceId).toBe('mock-test-workspace-for-build-verification');
    });

    it('should NOT be authenticated when environment variables are missing', () => {
      // Ensure environment variables are not set
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // Instantiate the server
      const server = new SmartSuiteShimServer();

      // Verify the server is not authenticated
      expect(server.isAuthenticated()).toBe(false);

      // Verify auth config is undefined
      expect(server.getAuthConfig()).toBeUndefined();
    });

    it('should call ensureAuthenticated in executeTool method', async () => {
      // Spy on the ensureAuthenticated method
      const ensureAuthSpy = vi.spyOn(SmartSuiteShimServer.prototype as any, 'ensureAuthenticated');

      // Set mock environment variables
      process.env.SMARTSUITE_API_TOKEN = 'mock-test-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'mock-test-workspace';

      const server = new SmartSuiteShimServer();

      // Mock the client to avoid actual API calls
      (server as any).client = { 
        listRecords: vi.fn().mockResolvedValue({ records: [] }) 
      };

      // Call executeTool
      try {
        await server.executeTool('smartsuite_query', {
          operation: 'list',
          appId: 'test-app-id'
        });
      } catch (error) {
        // We expect this to fail with field mappings error, but that's OK
        // We're just verifying ensureAuthenticated was called
      }

      // Verify ensureAuthenticated was called
      expect(ensureAuthSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle auto-authentication failure gracefully', async () => {
      // Mock createAuthenticatedClient to simulate API failure
      const { createAuthenticatedClient } = await import('../build/src/smartsuite-client.js');
      vi.mock('../build/src/smartsuite-client.js', async (importOriginal) => {
        const actual = await importOriginal() as any;
        return {
          ...actual,
          createAuthenticatedClient: vi.fn().mockRejectedValue(new Error('API error 400: Bad Request'))
        };
      });

      // Set mock environment variables
      process.env.SMARTSUITE_API_TOKEN = 'invalid-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'invalid-workspace';

      const server = new SmartSuiteShimServer();

      // Wait a tick for auto-auth promise to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      // Server should still report as authenticated (has config)
      expect(server.isAuthenticated()).toBe(true);

      // But executing a tool should fail with auth error
      await expect(server.executeTool('smartsuite_query', {
        operation: 'list',
        appId: 'test-app-id'
      })).rejects.toThrow('Authentication required');
    });
  });

  describe('Build output integrity', () => {
    it('should have all required methods in the built JavaScript', () => {
      const server = new SmartSuiteShimServer();

      // Verify critical methods exist and are functions
      expect(typeof server.isAuthenticated).toBe('function');
      expect(typeof server.getAuthConfig).toBe('function');
      expect(typeof server.authenticate).toBe('function');
      expect(typeof server.executeTool).toBe('function');
      expect(typeof server.getTools).toBe('function');
      expect(typeof (server as any).initialize).toBe('function');
      expect(typeof (server as any).ensureAuthenticated).toBe('function');
    });

    it('should have correct method signatures', () => {
      const server = new SmartSuiteShimServer();

      // Check method lengths (number of expected parameters)
      expect(server.isAuthenticated.length).toBe(0); // No parameters
      expect(server.getAuthConfig.length).toBe(0); // No parameters
      expect(server.authenticate.length).toBe(1); // config parameter
      expect(server.executeTool.length).toBe(2); // toolName, args
      expect(server.getTools.length).toBe(0); // No parameters
    });
  });
});