// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Implementation-Lead: Simple test for facade functionality
// Context7: consulted for vitest

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ToolContext } from './types.js';
import { handleIntelligentFacade } from './intelligent-facade.js';

// Mock handlers
vi.mock('./query.js', () => ({
  handleQuery: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock('./intelligent.js', () => ({
  handleIntelligent: vi.fn().mockResolvedValue({ analysis: 'result' }),
}));

describe('IntelligentFacade Simple Tests', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Simple mock context that matches the interface
    mockContext = {
      client: {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        listRecords: vi.fn(),
        countRecords: vi.fn(),
        getRecord: vi.fn(),
        createRecord: vi.fn(),
        updateRecord: vi.fn(),
        deleteRecord: vi.fn(),
        getSchema: vi.fn(),
      },
      fieldTranslator: {
        translateFieldNamesToIds: vi.fn((data) => data),
        translateFieldIdsToNames: vi.fn((data) => data),
        hasMappings: vi.fn(() => false),
        humanToApi: vi.fn((_appId, data) => data),
        apiToHuman: vi.fn((_appId, data) => data),
      },
      tableResolver: {
        resolveTableId: vi.fn(),
        listAvailableTables: vi.fn(),
        getSuggestionsForUnknown: vi.fn().mockReturnValue([]),
      },
      auditLogger: {
        logOperation: vi.fn(),
        getOperationLog: vi.fn(),
      },
    } as any;
  });

  it('should handle basic routing to query', async () => {
    const args = {
      endpoint: '/applications/123/records',
      method: 'GET' as const,
      operation_description: 'list records',
      tableId: '123',
    };

    const result = await handleIntelligentFacade(mockContext, args);

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('should fallback to intelligent handler', async () => {
    const args = {
      endpoint: '/custom/endpoint',
      method: 'POST' as const,
      operation_description: 'complex custom operation',
    };

    const result = await handleIntelligentFacade(mockContext, args);

    expect(result).toEqual({ analysis: 'result' });
  });
});