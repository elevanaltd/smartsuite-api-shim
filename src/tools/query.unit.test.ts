// Context7: consulted for vitest
// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { FieldTranslator } from '../lib/field-translator.js';
import type { TableResolver } from '../lib/table-resolver.js';
import type { SmartSuiteClient } from '../smartsuite-client.js';

import { handleQuery } from './query.js';
import type { ToolContext } from './types.js';

describe('handleQuery Tool Function', () => {
  let mockContext: ToolContext;
  let mockClient: SmartSuiteClient;
  let mockFieldTranslator: FieldTranslator;
  let mockTableResolver: TableResolver;

  beforeEach(() => {
    mockClient = {
      listRecords: vi.fn(),
      getRecord: vi.fn(),
      searchRecords: vi.fn(),
      countRecords: vi.fn(),
    } as any;

    mockFieldTranslator = {
      translateFieldNamesToIds: vi.fn((x) => x),
      translateFieldIdsToNames: vi.fn((x) => x),
      hasMappings: vi.fn(() => false),
      humanToApi: vi.fn((_appId, data) => data),
      apiToHuman: vi.fn((_appId, data) => data),
    } as any;

    mockTableResolver = {
      resolveTableId: vi.fn((id) => id),
      getSuggestionsForUnknown: vi.fn(() => []),
      getAllTableNames: vi.fn(() => []),
    } as any;

    mockContext = {
      client: mockClient,
      fieldTranslator: mockFieldTranslator,
      tableResolver: mockTableResolver,
      auditLogger: {
        logMutation: vi.fn(),
      } as any,
    };
  });

  describe('Type-safe operation validation', () => {
    it('should safely check operation type without using any', async () => {
      const args = {
        operation: 'invalid-operation',
        appId: 'test-app',
      };

      await expect(handleQuery(mockContext, args)).rejects.toThrow(
        'Unknown query operation: invalid-operation',
      );
    });

    it('should accept valid operations', async () => {
      // Test list operation
      const listArgs = {
        operation: 'list',
        appId: 'test-app',
      };
      mockClient.listRecords.mockResolvedValue({ data: [] });
      await expect(handleQuery(mockContext, listArgs)).resolves.toBeDefined();

      // Test get operation (needs recordId)
      const getArgs = {
        operation: 'get',
        appId: 'test-app',
        recordId: 'record-123',
      };
      mockClient.getRecord.mockResolvedValue({ id: 'record-123', data: {} });
      await expect(handleQuery(mockContext, getArgs)).resolves.toBeDefined();

      // Test search operation
      const searchArgs = {
        operation: 'search',
        appId: 'test-app',
      };
      mockClient.searchRecords.mockResolvedValue({ data: [] });
      await expect(handleQuery(mockContext, searchArgs)).resolves.toBeDefined();

      // Test count operation
      const countArgs = {
        operation: 'count',
        appId: 'test-app',
      };
      mockClient.countRecords.mockResolvedValue({ count: 0 });
      await expect(handleQuery(mockContext, countArgs)).resolves.toBeDefined();
    });

    it('should handle non-string operation gracefully', async () => {
      const args = {
        operation: 123, // number instead of string
        appId: 'test-app',
      };

      await expect(handleQuery(mockContext, args)).rejects.toThrow('Invalid query arguments');
    });
  });

  it('should handle list operation with function module pattern', async () => {
    const mockResponse = {
      items: [{ id: '1', title: 'Test' }],
      total: 1,
      offset: 0,
      limit: 200,
    };

    (mockClient.listRecords as any).mockResolvedValue(mockResponse);

    const args = {
      operation: 'list',
      appId: 'test-app-id',
      limit: 5,
    };

    const result = await handleQuery(mockContext, args);

    expect(mockTableResolver.resolveTableId).toHaveBeenCalledWith('test-app-id');
    expect(mockClient.listRecords as any).toHaveBeenCalled();
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
    expect(result).toHaveProperty('total');
  });

  it('should handle get operation with function module pattern', async () => {
    const mockRecord = { id: 'rec-123', title: 'Test Record' };
    (mockClient.getRecord as any).mockResolvedValue(mockRecord);

    const args = {
      operation: 'get',
      appId: 'test-app-id',
      recordId: 'rec-123',
    };

    const result = await handleQuery(mockContext, args);

    expect(mockTableResolver.resolveTableId).toHaveBeenCalledWith('test-app-id');
    expect(mockClient.getRecord as any).toHaveBeenCalledWith('test-app-id', 'rec-123');
    expect(result).toEqual(mockRecord);
  });

  it('should handle count operation', async () => {
    (mockClient.countRecords as any).mockResolvedValue(42);

    const args = {
      operation: 'count',
      appId: 'test-app-id',
    };

    const result = await handleQuery(mockContext, args);

    expect(mockTableResolver.resolveTableId).toHaveBeenCalledWith('test-app-id');
    expect(mockClient.countRecords as any).toHaveBeenCalled();
    expect(result).toEqual({ count: 42 });
  });

  it('should use audit logger when provided', async () => {
    const args = {
      operation: 'list',
      appId: 'test-app-id',
    };

    (mockClient.listRecords as any).mockResolvedValue({ items: [], total: 0 });

    await handleQuery(mockContext, args);
  });
});
