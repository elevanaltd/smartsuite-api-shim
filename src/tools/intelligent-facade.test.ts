// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Implementation-Lead: Test-first implementation for Strangler Fig facade
// Context7: consulted for vitest - test framework already configured in project

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleIntelligentFacade } from './intelligent-facade.js';
import type { ToolContext } from './types.js';

// Mock all the handlers we'll be routing to
vi.mock('./query.js', () => ({
  handleQuery: vi.fn(),
}));

vi.mock('./record.js', () => ({
  handleRecord: vi.fn(),
}));

vi.mock('./schema.js', () => ({
  handleSchema: vi.fn(),
}));

vi.mock('./undo.js', () => ({
  handleUndo: vi.fn(),
}));

vi.mock('./discover.js', () => ({
  handleDiscover: vi.fn(),
}));

vi.mock('./intelligent.js', () => ({
  handleIntelligent: vi.fn(),
}));

vi.mock('./knowledge.js', () => ({
  handleKnowledgeEvents: vi.fn(),
  handleKnowledgeFieldMappings: vi.fn(),
  handleKnowledgeRefreshViews: vi.fn(),
}));

import { handleIntelligent } from './intelligent.js';
import { handleQuery } from './query.js';
import { handleRecord } from './record.js';
import { handleSchema } from './schema.js';

describe('IntelligentFacade', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock context
    mockContext = {
      client: {
        listRecords: vi.fn(),
        getRecord: vi.fn(),
        createRecord: vi.fn(),
        updateRecord: vi.fn(),
        deleteRecord: vi.fn(),
        getSchema: vi.fn(),
        getApplications: vi.fn(),
      },
      fieldTranslator: {
        translateFields: vi.fn().mockImplementation((data) => data),
      },
      transactionHistory: {
        recordOperation: vi.fn(),
        getLastOperation: vi.fn(),
        undoOperation: vi.fn(),
        listOperations: vi.fn(),
      },
      knowledgeBase: {
        getFieldMappings: vi.fn(),
        updateFieldMappings: vi.fn(),
      },
    };
  });

  describe('Query Operation Routing', () => {
    it('should route "list records" operation to smartsuite_query handler', async () => {
      // RED: This test will fail because handleIntelligentFacade doesn't exist yet
      const mockQueryResponse = { items: [], total: 0 };
      (handleQuery as any).mockResolvedValue(mockQueryResponse);

      const args = {
        endpoint: '/applications/123/records',
        method: 'GET' as const,
        operation_description: 'list records from the application',
        tableId: '123',
      };

      const result = await handleIntelligentFacade(mockContext, args);

      expect(handleQuery).toHaveBeenCalledWith(mockContext, {
        operation: 'list',
        appId: '123',
        filters: undefined,
        sort: undefined,
        limit: undefined,
        offset: undefined,
        recordId: undefined,
      });

      expect(result).toEqual(mockQueryResponse);
    });

    it('should route "get record" operation to smartsuite_query handler with recordId', async () => {
      const mockQueryResponse = { id: '456', name: 'Test Record' };
      (handleQuery as any).mockResolvedValue(mockQueryResponse);

      const args = {
        endpoint: '/applications/123/records/456',
        method: 'GET' as const,
        operation_description: 'get specific record by ID',
        tableId: '123',
        payload: { recordId: '456' },
      };

      const result = await handleIntelligentFacade(mockContext, args);

      expect(handleQuery).toHaveBeenCalledWith(mockContext, {
        operation: 'get',
        appId: '123',
        filters: undefined,
        sort: undefined,
        limit: undefined,
        offset: undefined,
        recordId: '456',
      });

      expect(result).toEqual(mockQueryResponse);
    });

    it('should route "search records" operation to smartsuite_query handler', async () => {
      const mockQueryResponse = { items: [{ id: '1', name: 'Found' }], total: 1 };
      (handleQuery as any).mockResolvedValue(mockQueryResponse);

      const args = {
        endpoint: '/applications/123/records/search',
        method: 'POST' as const,
        operation_description: 'search records with filter criteria',
        tableId: '123',
        payload: {
          filters: { name: 'Test' },
          limit: 10,
        },
      };

      const result = await handleIntelligentFacade(mockContext, args);

      expect(handleQuery).toHaveBeenCalledWith(mockContext, {
        operation: 'search',
        appId: '123',
        filters: { name: 'Test' },
        sort: undefined,
        limit: 10,
        offset: undefined,
        recordId: undefined,
      });

      expect(result).toEqual(mockQueryResponse);
    });
  });

  describe('Record Operation Routing', () => {
    it('should route "create record" operation to smartsuite_record handler', async () => {
      const mockRecordResponse = { id: '789', name: 'New Record' };
      (handleRecord as any).mockResolvedValue(mockRecordResponse);

      const args = {
        endpoint: '/applications/123/records',
        method: 'POST' as const,
        operation_description: 'create new record with data',
        tableId: '123',
        payload: { data: { name: 'New Record' } },
        mode: 'execute' as const,
      };

      const result = await handleIntelligentFacade(mockContext, args);

      expect(handleRecord).toHaveBeenCalledWith(mockContext, {
        operation: 'create',
        appId: '123',
        recordId: undefined,
        data: { data: { name: 'New Record' } },
        dry_run: false, // execute mode should set dry_run to false
      });

      expect(result).toEqual(mockRecordResponse);
    });

    it('should default to dry_run mode when mode is not execute', async () => {
      const mockRecordResponse = { dry_run: true, preview: 'would create record' };
      (handleRecord as any).mockResolvedValue(mockRecordResponse);

      const args = {
        endpoint: '/applications/123/records',
        method: 'POST' as const,
        operation_description: 'create new record with data',
        tableId: '123',
        payload: { data: { name: 'New Record' } },
        // mode omitted - should default to dry_run
      };

      const result = await handleIntelligentFacade(mockContext, args);

      expect(handleRecord).toHaveBeenCalledWith(mockContext, {
        operation: 'create',
        appId: '123',
        recordId: undefined,
        data: { data: { name: 'New Record' } },
        dry_run: true, // should default to dry_run when mode is not execute
      });

      expect(result).toEqual(mockRecordResponse);
    });
  });

  describe('Explicit Legacy Routing', () => {
    it('should use explicit _route_to_legacy when provided', async () => {
      const mockSchemaResponse = { fields: [], name: 'Test App' };
      (handleSchema as any).mockResolvedValue(mockSchemaResponse);

      const args = {
        endpoint: '/applications/123/schema',
        method: 'GET' as const,
        operation_description: 'This looks like a query but should route to schema',
        _route_to_legacy: 'smartsuite_schema',
        _legacy_args: {
          appId: '123',
          output_mode: 'detailed',
        },
      };

      const result = await handleIntelligentFacade(mockContext, args);

      expect(handleSchema).toHaveBeenCalledWith(mockContext, {
        appId: '123',
        output_mode: 'detailed',
      });

      expect(result).toEqual(mockSchemaResponse);

      // Verify query handler was NOT called
      expect(handleQuery).not.toHaveBeenCalled();
    });
  });

  describe('Fallback to Original Intelligent Handler', () => {
    it('should route to original intelligent handler when no routing pattern matches', async () => {
      const mockIntelligentResponse = { analysis: 'complex operation result' };
      (handleIntelligent as any).mockResolvedValue(mockIntelligentResponse);

      const args = {
        endpoint: '/custom/advanced/endpoint',
        method: 'PATCH' as const,
        operation_description: 'perform complex custom operation that does not match any pattern',
        payload: { complex: 'data' },
      };

      const result = await handleIntelligentFacade(mockContext, args);

      expect(handleIntelligent).toHaveBeenCalledWith(mockContext, args);
      expect(result).toEqual(mockIntelligentResponse);

      // Verify no legacy handlers were called
      expect(handleQuery).not.toHaveBeenCalled();
      expect(handleRecord).not.toHaveBeenCalled();
      expect(handleSchema).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from routed handlers', async () => {
      const mockError = new Error('Query handler failed');
      (handleQuery as any).mockRejectedValue(mockError);

      const args = {
        endpoint: '/applications/123/records',
        method: 'GET' as const,
        operation_description: 'list records from the application',
        tableId: '123',
      };

      await expect(handleIntelligentFacade(mockContext, args)).rejects.toThrow(
        'Query handler failed',
      );
    });

    it('should validate input arguments with zod schema', async () => {
      // Invalid args - missing required fields
      const invalidArgs = {
        // missing endpoint
        method: 'GET' as const,
        // missing operation_description
      };

      await expect(handleIntelligentFacade(mockContext, invalidArgs)).rejects.toThrow();
    });
  });

  describe('App ID Extraction', () => {
    it('should extract app ID from endpoint when tableId is not provided', async () => {
      const mockQueryResponse = { items: [], total: 0 };
      (handleQuery as any).mockResolvedValue(mockQueryResponse);

      const args = {
        endpoint: '/applications/68a8ff5237fde0bf797c05b3/records',
        method: 'GET' as const,
        operation_description: 'list records',
        // tableId omitted - should extract from endpoint
      };

      const result = await handleIntelligentFacade(mockContext, args);

      // TESTGUARD-APPROVED: CONTRACT-DRIVEN-CORRECTION - Adding missing assertion for return value
      expect(handleQuery).toHaveBeenCalledWith(mockContext, {
        operation: 'list',
        appId: '68a8ff5237fde0bf797c05b3', // extracted from endpoint
        filters: undefined,
        sort: undefined,
        limit: undefined,
        offset: undefined,
        recordId: undefined,
      });

      expect(result).toEqual(mockQueryResponse);
    });
  });
});
