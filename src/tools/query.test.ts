// Context7: consulted for vitest
// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleQuery } from './query';
import type { ToolContext } from './types';
import type { SmartSuiteClient } from '../smartsuite-client';
import type { FieldTranslator } from '../lib/field-translator';
import type { TableResolver } from '../lib/table-resolver';

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
      translateFieldNamesToIds: vi.fn(x => x),
      translateFieldIdsToNames: vi.fn(x => x),
      hasMappings: vi.fn(() => false),
      humanToApi: vi.fn((_appId, data) => data),
      apiToHuman: vi.fn((_appId, data) => data),
    } as any;

    mockTableResolver = {
      resolveTableId: vi.fn(id => id),
      getSuggestionsForUnknown: vi.fn(() => []),
      getAllTableNames: vi.fn(() => []),
    } as any;

    mockContext = {
      client: mockClient,
      fieldTranslator: mockFieldTranslator,
      tableResolver: mockTableResolver,
      auditLogger: {
        logToolCall: vi.fn(),
      } as any,
    };
  });

  it('should handle list operation with function module pattern', async () => {
    const mockResponse = {
      items: [{ id: '1', title: 'Test' }],
      total: 1,
      offset: 0,
      limit: 200
    };
    
    (mockClient.listRecords as any).mockResolvedValue(mockResponse);

    const args = {
      operation: 'list',
      appId: 'test-app-id',
      limit: 5
    };

    const result = await handleQuery(mockContext, args);

    expect(mockTableResolver.resolveTableId).toHaveBeenCalledWith('test-app-id');
    expect(mockClient.listRecords).toHaveBeenCalled();
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('pagination');
  });

  it('should handle get operation with function module pattern', async () => {
    const mockRecord = { id: 'rec-123', title: 'Test Record' };
    (mockClient.getRecord as any).mockResolvedValue(mockRecord);

    const args = {
      operation: 'get',
      appId: 'test-app-id',
      recordId: 'rec-123'
    };

    const result = await handleQuery(mockContext, args);

    expect(mockTableResolver.resolveTableId).toHaveBeenCalledWith('test-app-id');
    expect(mockClient.getRecord).toHaveBeenCalledWith('test-app-id', 'rec-123');
    expect(result).toEqual(mockRecord);
  });

  it('should handle count operation', async () => {
    (mockClient.countRecords as any).mockResolvedValue(42);

    const args = {
      operation: 'count',
      appId: 'test-app-id'
    };

    const result = await handleQuery(mockContext, args);

    expect(mockTableResolver.resolveTableId).toHaveBeenCalledWith('test-app-id');
    expect(mockClient.countRecords).toHaveBeenCalled();
    expect(result).toEqual({ count: 42 });
  });

  it('should use audit logger when provided', async () => {
    const args = {
      operation: 'list',
      appId: 'test-app-id'
    };

    (mockClient.listRecords as any).mockResolvedValue({ items: [], total: 0 });

    await handleQuery(mockContext, args);

    expect(mockContext.auditLogger.logToolCall).toHaveBeenCalledWith(
      'smartsuite_query',
      args,
      expect.any(Object)
    );
  });
});