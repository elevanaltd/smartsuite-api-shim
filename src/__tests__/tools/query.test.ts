// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleQuery } from '../../tools/query';
import type { ToolContext } from '../../tools/types';
import type { SmartSuiteClient } from '../../smartsuite-client';
import type { FieldTranslator } from '../../lib/field-translator';
import type { TableResolver } from '../../lib/table-resolver';

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
    } as any;

    mockFieldTranslator = {
      translateFieldNamesToIds: vi.fn(x => x),
      translateFieldIdsToNames: vi.fn(x => x),
    } as any;

    mockTableResolver = {
      resolveTableId: vi.fn(id => id),
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
      meta: { total: 1 }
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

  it('should use audit logger when provided', async () => {
    const args = {
      operation: 'list',
      appId: 'test-app-id'
    };

    await handleQuery(mockContext, args);

    expect(mockContext.auditLogger.logToolCall).toHaveBeenCalledWith(
      'smartsuite_query',
      args,
      expect.any(Object)
    );
  });
});