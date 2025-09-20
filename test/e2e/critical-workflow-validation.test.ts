// Test-Methodology-Guardian: Critical workflow validation for Sentinel Architecture
// CRITICAL: End-to-end test of most important CRUD operations through facade
// Strategy: Real API calls through facade to validate complete workflow
// Context7: consulted for vitest
// TESTGUARD_BYPASS: TypeScript type safety fixes only - no test behavior changes

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { SmartSuiteShimServer } from '../../src/mcp-server.js';

describe('Critical Workflow Validation - E2E', () => {
  const testTableId = process.env.SMARTSUITE_TEST_TABLE_ID || '68ab34b30b1e05e11a8ba87f';
  let server: SmartSuiteShimServer;

  beforeAll(async () => {
    // Skip E2E tests if we don't have credentials
    if (!process.env.SMARTSUITE_API_TOKEN || process.env.VALIDATION_MODE === 'true') {
      console.log('Skipping E2E tests - no credentials or validation mode enabled');
      return;
    }

    server = new SmartSuiteShimServer();
    if (!server) {
      console.log('Skipping E2E tests - server not available');
      return;
    }

    try {
      await server.initialize();
    } catch (error) {
      console.log('Skipping E2E tests - initialization failed:', error instanceof Error ? error.message : String(error));
    }
  });

  afterAll(async () => {
    if (server && 'close' in server) {
      await (server as any).close();
    }
  });

  // Helper to check if we can run E2E tests
  const skipIfNoCredentials = () => {
    if (!process.env.SMARTSUITE_API_TOKEN || process.env.VALIDATION_MODE === 'true') {
      console.log('Skipping test - no credentials or validation mode');
      return true;
    }
    return false;
  };

  it('should discover tables through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_discover',
      operation_description: 'discover available tables',
    });

    expect(result).toBeDefined();
    expect((result as any).success).toBe(true);
    expect((result as any).tables).toEqual(expect.any(Array));
  });

  it('should get table schema through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_schema',
      operation_description: 'get schema for test table',
      appId: testTableId,
    });

    expect(result).toBeDefined();
    expect((result as any).table_id).toBe(testTableId);
    expect((result as any).fields).toEqual(expect.any(Array));
  });

  it('should list records through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_query',
      operation_description: 'list records from test table',
      operation: 'list_records',
      appId: testTableId,
      limit: 5,
    });

    expect(result).toBeDefined();
    expect((result as any).success).toBe(true);
    expect((result as any).records).toEqual(expect.any(Array));
  });

  it('should handle dry-run record creation through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const testData = {
      se85e21506: 'Test Record from E2E Test', // Title field
      s64ae0e35c: 'automated-test', // Status field
    };

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_record',
      operation_description: 'create test record with dry run',
      operation: 'create',
      appId: testTableId,
      data: testData,
      dry_run: true,
    });

    expect(result).toBeDefined();
    expect((result as any).success).toBe(true);
    expect((result as any).dry_run).toBe(true);
    // Should not actually create the record
    expect((result as any).record_id).toBeUndefined();
  });

  it('should validate field discovery through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_discover',
      operation_description: 'discover fields for test table',
      table_name: testTableId,
    });

    expect(result).toBeDefined();
    expect((result as any).success).toBe(true);
    expect((result as any).fields).toEqual(expect.any(Object));

    // Should include known test table fields
    expect((result as any).fields).toHaveProperty('se85e21506'); // Title field
    expect((result as any).fields).toHaveProperty('s64ae0e35c'); // Status field
  });

  it('should handle count operations through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_query',
      operation_description: 'count records in test table',
      operation: 'count_records',
      appId: testTableId,
    });

    expect(result).toBeDefined();
    expect((result as any).success).toBe(true);
    expect(typeof (result as any).count).toBe('number');
    expect((result as any).count).toBeGreaterThanOrEqual(0);
  });

  it('should validate undo functionality exists', async () => {
    if (skipIfNoCredentials()) return;

    // Test that undo tool is available (even if no transactions to undo)
    try {
      await server.callTool('smartsuite_undo', {
        operation_description: 'test undo availability',
        transaction_id: 'non-existent-transaction',
      });
    } catch (error) {
      // Should fail with transaction not found, not tool not found
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).not.toContain('Unknown tool');
      expect(errorMessage).toContain('Transaction not found');
    }
  });

  it('should handle filtering through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_query',
      operation_description: 'list records with status filter',
      operation: 'list_records',
      appId: testTableId,
      limit: 3,
      filters: {
        field: 's64ae0e35c', // Status field
        comparison: 'is',
        value: 'automated-test',
      },
    });

    expect(result).toBeDefined();
    expect((result as any).success).toBe(true);
    expect((result as any).records).toEqual(expect.any(Array));
  });
});
