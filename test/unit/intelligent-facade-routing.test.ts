// Test-Methodology-Guardian: Contract-driven test for new Sentinel Architecture
// CRITICAL: Tests the 2-tool interface contract, not the old 9-tool system
// Strategy: Behavioral validation of facade routing through tool_name parameter
// Context7: consulted for vitest

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IntelligentFacadeTool } from '../../src/tools/intelligent-facade.js';
import type { ToolContext } from '../../src/tools/types.js';

// Mock all the legacy tool handlers to validate routing only
vi.mock('../../src/tools/query.js', () => ({
  handleQuery: vi.fn().mockResolvedValue({ success: true, operation: 'query' }),
}));

vi.mock('../../src/tools/record.js', () => ({
  handleRecord: vi.fn().mockResolvedValue({ success: true, operation: 'record' }),
}));

vi.mock('../../src/tools/schema.js', () => ({
  handleSchema: vi.fn().mockResolvedValue({ success: true, operation: 'schema' }),
}));

vi.mock('../../src/tools/discover.js', () => ({
  handleDiscover: vi.fn().mockResolvedValue({ success: true, operation: 'discover' }),
}));

vi.mock('../../src/tools/undo.js', () => ({
  handleUndo: vi.fn().mockResolvedValue({ success: true, operation: 'undo' }),
}));

describe('Intelligent Facade Routing - Sentinel Architecture', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      serverInstance: {} as any,
      clientInstance: {} as any,
      mappingService: {} as any,
      knowledgeService: {} as any,
      transactionHistory: {} as any,
    };
    vi.clearAllMocks();
  });

  it('should have correct tool definition for Sentinel Architecture', () => {
    expect(IntelligentFacadeTool.name).toBe('smartsuite_intelligent');
    expect(IntelligentFacadeTool.description).toContain('AI-guided access to any SmartSuite API');
    expect(IntelligentFacadeTool.schema).toBeDefined();
    expect(IntelligentFacadeTool.execute).toBeInstanceOf(Function);
  });

  it('should route to query handler via tool_name parameter with correct transformation', async () => {
    const { handleQuery } = await import('../../src/tools/query.js');

    const args = {
      tool_name: 'smartsuite_query',
      operation_description: 'list records from table',
      operation: 'list_records',
      appId: 'test-table-id',
    };

    const result = await IntelligentFacadeTool.execute(mockContext, args);

    // Facade should call handleQuery with (context, transformedArgs)
    expect(handleQuery).toHaveBeenCalledWith(
      mockContext,
      expect.objectContaining({
        operation: 'list', // Facade transforms 'list_records' to 'list'
        appId: 'test-table-id',
        filters: undefined,
        sort: undefined,
        limit: undefined,
        offset: undefined,
        recordId: undefined,
      }),
    );
    expect(result).toEqual({ success: true, operation: 'query' });
  });

  it('should route to record handler via tool_name parameter with correct transformation', async () => {
    const { handleRecord } = await import('../../src/tools/record.js');

    const args = {
      tool_name: 'smartsuite_record',
      operation_description: 'create a new record',
      operation: 'create',
      appId: 'test-table-id',
      data: { name: 'Test Record' },
      dry_run: true,
    };

    const result = await IntelligentFacadeTool.execute(mockContext, args);

    expect(handleRecord).toHaveBeenCalledWith(
      mockContext,
      expect.objectContaining({
        operation: 'create',
        appId: 'test-table-id',
        data: {}, // Facade transforms data from top-level args
        dry_run: true,
        recordId: undefined,
      }),
    );
    expect(result).toEqual({ success: true, operation: 'record' });
  });

  it('should route to schema handler via tool_name parameter with correct transformation', async () => {
    const { handleSchema } = await import('../../src/tools/schema.js');

    const args = {
      tool_name: 'smartsuite_schema',
      operation_description: 'get table schema',
      appId: 'test-table-id',
    };

    const result = await IntelligentFacadeTool.execute(mockContext, args);

    expect(handleSchema).toHaveBeenCalledWith(
      mockContext,
      expect.objectContaining({
        appId: 'test-table-id',
        output_mode: 'summary', // Default output mode
      }),
    );
    expect(result).toEqual({ success: true, operation: 'schema' });
  });

  it('should route to discover handler via tool_name parameter with correct transformation', async () => {
    const { handleDiscover } = await import('../../src/tools/discover.js');

    const args = {
      tool_name: 'smartsuite_discover',
      operation_description: 'discover available tables',
    };

    const result = await IntelligentFacadeTool.execute(mockContext, args);

    expect(handleDiscover).toHaveBeenCalledWith(
      mockContext,
      expect.objectContaining({
        scope: 'tables', // Facade sets default scope for discover
      }),
    );
    expect(result).toEqual({ success: true, operation: 'discover' });
  });

  it('should handle undo operations with correct transformation', async () => {
    const { handleUndo } = await import('../../src/tools/undo.js');

    const args = {
      tool_name: 'smartsuite_undo',
      operation_description: 'undo last operation',
      payload: { transaction_id: 'test-transaction-123' },
    };

    const result = await IntelligentFacadeTool.execute(mockContext, args);

    expect(handleUndo).toHaveBeenCalledWith(
      mockContext,
      expect.objectContaining({
        transaction_id: 'test-transaction-123',
      }),
    );
    expect(result).toEqual({ success: true, operation: 'undo' });
  });

  it('should throw error for unknown tool_name', async () => {
    const args = {
      tool_name: 'unknown_tool' as any,
      operation_description: 'unknown operation',
    };

    await expect(IntelligentFacadeTool.execute(mockContext, args)).rejects.toThrow();
  });

  it('should require endpoint/method when no tool_name is provided', async () => {
    const args = {
      operation_description: 'some operation without routing',
    };

    await expect(IntelligentFacadeTool.execute(mockContext, args)).rejects.toThrow(
      /No routing target detected and endpoint\/method missing/,
    );
  });

  it('should validate operation_description is required', () => {
    const schema = IntelligentFacadeTool.schema;

    // Validate schema requires operation_description
    expect(() => {
      schema.parse({
        tool_name: 'smartsuite_query',
        // Missing operation_description
      });
    }).toThrow();

    // Validate schema accepts operation_description
    expect(() => {
      schema.parse({
        tool_name: 'smartsuite_query',
        operation_description: 'valid description',
      });
    }).not.toThrow();
  });

  it('should handle payload data correctly for record operations', async () => {
    const { handleRecord } = await import('../../src/tools/record.js');

    const args = {
      tool_name: 'smartsuite_record',
      operation_description: 'create record with payload data',
      operation: 'create',
      appId: 'test-table-id',
      payload: {
        data: { name: 'Test Record', status: 'active' },
        recordId: 'test-record-123',
      },
      dry_run: false,
    };

    const result = await IntelligentFacadeTool.execute(mockContext, args);

    expect(handleRecord).toHaveBeenCalledWith(
      mockContext,
      expect.objectContaining({
        operation: 'create',
        appId: 'test-table-id',
        data: { name: 'Test Record', status: 'active' },
        recordId: 'test-record-123',
        dry_run: false,
      }),
    );
    expect(result).toEqual({ success: true, operation: 'record' });
  });

  it('should handle query filters and pagination correctly', async () => {
    const { handleQuery } = await import('../../src/tools/query.js');

    const args = {
      tool_name: 'smartsuite_query',
      operation_description: 'query with filters and pagination',
      operation: 'list_records',
      appId: 'test-table-id',
      payload: {
        filters: { status: 'active' },
        sort: { created_date: 'desc' },
        limit: 10,
        offset: 20,
      },
    };

    const result = await IntelligentFacadeTool.execute(mockContext, args);

    expect(handleQuery).toHaveBeenCalledWith(
      mockContext,
      expect.objectContaining({
        operation: 'list',
        appId: 'test-table-id',
        filters: { status: 'active' },
        sort: { created_date: 'desc' },
        limit: 10,
        offset: 20,
      }),
    );
    expect(result).toEqual({ success: true, operation: 'query' });
  });
});
