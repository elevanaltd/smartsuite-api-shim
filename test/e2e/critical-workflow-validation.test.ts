// Test-Methodology-Guardian: Critical workflow validation for Sentinel Architecture
// CRITICAL: End-to-end test of most important CRUD operations through facade
// Strategy: Real API calls through facade to validate complete workflow
// Context7: consulted for vitest

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { SmartSuiteShimServer } from '../../src/mcp-server.js';

describe('Critical Workflow Validation - E2E', () => {
  let server: SmartSuiteShimServer;
  const testTableId = '68ab34b30b1e05e11a8ba87f'; // Test table ID

  beforeAll(async () => {
    server = new SmartSuiteShimServer();

    // Only run if we have test credentials
    if (!process.env.SMARTSUITE_API_TOKEN || process.env.VALIDATION_MODE === 'true') {
      console.log('Skipping E2E tests - no credentials or validation mode');
      return;
    }

    try {
      await server.initialize();
    } catch (error) {
      console.log('Skipping E2E tests - initialization failed:', error.message);
    }
  });

  afterAll(async () => {
    if (server) {
      await server.close();
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
    expect(result.success).toBe(true);
    expect(result.tables).toEqual(expect.any(Array));
  });

  it('should get table schema through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_schema',
      operation_description: 'get schema for test table',
      appId: testTableId,
    });

    expect(result).toBeDefined();
    expect(result.table_id).toBe(testTableId);
    expect(result.fields).toEqual(expect.any(Array));
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
    expect(result.success).toBe(true);
    expect(result.records).toEqual(expect.any(Array));
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
    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(true);
    // Should not actually create the record
    expect(result.record_id).toBeUndefined();
  });

  it('should validate field discovery through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_discover',
      operation_description: 'discover fields for test table',
      table_name: testTableId,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.fields).toEqual(expect.any(Object));

    // Should include known test table fields
    expect(result.fields).toHaveProperty('se85e21506'); // Title field
    expect(result.fields).toHaveProperty('s64ae0e35c'); // Status field
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
    expect(result.success).toBe(true);
    expect(typeof result.count).toBe('number');
    expect(result.count).toBeGreaterThanOrEqual(0);
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
      expect(error.message).not.toContain('Unknown tool');
      expect(error.message).toContain('Transaction not found');
    }
  });

  it('should handle filtering through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_query',
      operation_description: 'list records with status filter',
      operation: 'list_records',
      appId: testTableId,
      filters: {
        s64ae0e35c: 'automated-test', // Status field
      },
      limit: 5,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.records).toEqual(expect.any(Array));
  });

  it('should support natural language operations through smartsuite_intelligent facade', async () => {
    if (skipIfNoCredentials()) return;

    const result = await server.callTool('smartsuite_intelligent', {
      operation_description: 'Get the schema for my test table to understand its structure',
      endpoint: `/v1/applications/${testTableId}`,
      method: 'GET',
    });

    expect(result).toBeDefined();
    // Should successfully route to schema handler
    expect((result as any).table_id || (result as any).id).toBe(testTableId);
  });

  it('should validate complete workflow: discover -> schema -> query -> create(dry-run)', async () => {
    if (skipIfNoCredentials()) return;

    // Step 1: Discover tables
    const discoverResult = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_discover',
      operation_description: 'discover available tables',
    });
    expect((discoverResult as any).success).toBe(true);

    // Step 2: Get schema
    const schemaResult = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_schema',
      operation_description: 'get schema for test table',
      appId: testTableId,
    });
    expect((schemaResult as any).table_id).toBe(testTableId);

    // Step 3: Query records
    const queryResult = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_query',
      operation_description: 'list existing records',
      operation: 'list_records',
      appId: testTableId,
      limit: 1,
    });
    expect((queryResult as any).success).toBe(true);

    // Step 4: Dry-run create
    const createResult = await server.callTool('smartsuite_intelligent', {
      tool_name: 'smartsuite_record',
      operation_description: 'test record creation with dry run',
      operation: 'create',
      appId: testTableId,
      data: { se85e21506: 'E2E Workflow Test' },
      dry_run: true,
    });
    expect((createResult as any).success).toBe(true);
    expect((createResult as any).dry_run).toBe(true);
  });
});
