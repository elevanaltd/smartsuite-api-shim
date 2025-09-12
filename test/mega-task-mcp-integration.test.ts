// TESTGUARD-TDD-GREEN-PHASE: Test MCP integration for mega-task factory
// Integration test for MCP server mega-task tool registration and execution

// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';
import * as SmartSuiteClientModule from '../src/smartsuite-client.js';
import type { SmartSuiteClient } from '../src/smartsuite-client.js';

describe('MegaTask MCP Integration', () => {
  let server: SmartSuiteShimServer;

  beforeEach(() => {
    server = new SmartSuiteShimServer();
  });

  describe('Tool Registration', () => {
    it('should register smartsuite_mega_task tool', () => {
      const tools = server.getTools();
      const megaTaskTool = tools.find(tool => tool.name === 'smartsuite_mega_task');

      expect(megaTaskTool).toBeDefined();
      expect(megaTaskTool?.description).toContain('EAV project workflows');
      expect((megaTaskTool?.inputSchema.properties as any)?.project_id).toBeDefined();
      expect((megaTaskTool?.inputSchema.properties as any)?.mode).toBeDefined();
    });

    it('should have correct schema for mega-task tool', () => {
      const tools = server.getTools();
      const megaTaskTool = tools.find(tool => tool.name === 'smartsuite_mega_task');

      expect(megaTaskTool?.inputSchema.required).toEqual(['project_id']);
      expect((megaTaskTool?.inputSchema.properties as any)?.project_id?.type).toBe('string');
      expect((megaTaskTool?.inputSchema.properties as any)?.mode?.enum).toEqual(['dry_run', 'execute']);
    });
  });

  describe('Tool Execution', () => {
    it('should require authentication for mega-task execution', async () => {
      await expect(server.callTool('smartsuite_mega_task', {
        project_id: '507f1f77bcf86cd799439011',
      })).rejects.toThrow('Authentication required');
    });

    it('should validate project_id format', async () => {
      // Mock the client creation to avoid API calls
      const mockClient = {
        getRecord: vi.fn(),
        bulkCreate: vi.fn(),
        bulkUpdate: vi.fn(),
      };

      vi.spyOn(SmartSuiteClientModule, 'createAuthenticatedClient')
        .mockResolvedValue(mockClient as unknown as SmartSuiteClient);

      await server.authenticate({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      await expect(server.callTool('smartsuite_mega_task', {
        project_id: 'invalid-id',
      })).rejects.toThrow('24-character hexadecimal');
    });

    it('should require project_id parameter', async () => {
      // Mock the client creation to avoid API calls
      const mockClient = {
        getRecord: vi.fn(),
        bulkCreate: vi.fn(),
        bulkUpdate: vi.fn(),
      };

      vi.spyOn(SmartSuiteClientModule, 'createAuthenticatedClient')
        .mockResolvedValue(mockClient as unknown as SmartSuiteClient);

      await server.authenticate({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      await expect(server.callTool('smartsuite_mega_task', {}))
        .rejects.toThrow('project_id is required');
    });
  });
});
