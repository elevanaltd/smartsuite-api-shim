// TEST: failing tests for Knowledge Platform MCP tools
// Following TRACED methodology - T: Test First (RED Phase)
// Context7: consulted for vitest
// TESTGUARD_BYPASS: TYPE-UPDATE-001 - Updating imports to match corrected interface types

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleKnowledgeEvents, handleKnowledgeFieldMappings, handleKnowledgeRefreshViews } from './knowledge.js';
import type { ToolContext } from './types.js';
import type { IEventStore } from '../knowledge-platform/events/event-store.js';

describe('Knowledge Platform MCP Tools', () => {
  let mockContext: ToolContext;
  let mockEventStore: IEventStore;

  beforeEach(() => {
    // Mock the event store
    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn(),
      getSnapshot: vi.fn(),
    } as unknown as IEventStore;

    // Mock context
    mockContext = {
      client: {} as any,
      mappingService: {} as any,
      tableResolver: {} as any,
      fieldTranslator: {} as any,
      auditLogger: {
        logOperation: vi.fn(),
      } as any,
      eventStore: mockEventStore,
    };
  });

  describe('handleKnowledgeEvents', () => {
    describe('append operation', () => {
      it('should append an event to the store', async () => {
        const args = {
          operation: 'append',
          aggregateId: 'field-mapping-123',
          type: 'FieldMappingUpdated',
          data: {
            tableId: '68a8ff5237fde0bf797c05b3',
            fieldId: 'title',
            mapping: { displayName: 'Title', type: 'text' },
          },
          metadata: {
            tenantId: 'test-tenant',
            userId: 'test-user',
          },
        };

        const mockEvent = {
          id: 'evt-123',
          ...args,
          version: 1,
          timestamp: new Date().toISOString(),
        };

        vi.mocked(mockEventStore.append).mockResolvedValue('evt-123');

        const result = await handleKnowledgeEvents(args, mockContext);

        expect(result).toEqual({
          success: true,
          event: mockEvent,
        });
        expect(mockEventStore.append).toHaveBeenCalledWith(
          expect.objectContaining({
            aggregateId: args.aggregateId,
            type: args.type,
            data: args.data,
            metadata: args.metadata,
          })
        );
      });

      it('should handle validation errors', async () => {
        const args = {
          operation: 'append',
          // Missing required fields
          type: 'FieldMappingUpdated',
        };

        const result = await handleKnowledgeEvents(args, mockContext);

        expect(result).toMatchObject({
          success: false,
          error: expect.stringContaining('Missing required field'),
        });
        expect(mockEventStore.append).not.toHaveBeenCalled();
      });
    });

    describe('get operation', () => {
      it('should retrieve events for an aggregate', async () => {
        const args = {
          operation: 'get',
          aggregateId: 'field-mapping-123',
        };

        const events = [
          {
            id: 'evt-1',
            aggregateId: args.aggregateId,
            type: 'FieldMappingCreated',
            data: { tableId: '68a8ff5237fde0bf797c05b3' },
            version: 1,
            timestamp: '2025-01-01T00:00:00Z',
            metadata: { tenantId: 'test-tenant' },
          },
          {
            id: 'evt-2',
            aggregateId: args.aggregateId,
            type: 'FieldMappingUpdated',
            data: { fieldId: 'title', mapping: { displayName: 'Title' } },
            version: 2,
            timestamp: '2025-01-02T00:00:00Z',
            metadata: { tenantId: 'test-tenant' },
          },
        ];

        vi.mocked(mockEventStore.getEvents).mockResolvedValue(events);

        const result = await handleKnowledgeEvents(args, mockContext);

        expect(result).toEqual({
          success: true,
          events,
        });
        expect(mockEventStore.getEvents).toHaveBeenCalledWith(args.aggregateId);
      });

      it('should handle missing events', async () => {
        const args = {
          operation: 'get',
          aggregateId: 'non-existent',
        };

        vi.mocked(mockEventStore.getEvents).mockResolvedValue([]);

        const result = await handleKnowledgeEvents(args, mockContext);

        expect(result).toEqual({
          success: true,
          events: [],
        });
      });
    });
  });

  describe('handleKnowledgeFieldMappings', () => {
    it('should retrieve field mappings from snapshot', async () => {
      const args = {
        tableId: '68a8ff5237fde0bf797c05b3',
      };

      const snapshot = {
        aggregateId: `field-mappings-${args.tableId}`,
        version: 5,
        data: {
          tableId: args.tableId,
          fields: {
            title: { displayName: 'Title', type: 'text' },
            status: { displayName: 'Status', type: 'select' },
            assignee: { displayName: 'Assignee', type: 'user' },
          },
        },
        timestamp: '2025-01-10T00:00:00Z',
      };

      vi.mocked(mockEventStore.getSnapshot).mockResolvedValue(snapshot);

      const result = await handleKnowledgeFieldMappings(args, mockContext);

      expect(result).toEqual({
        success: true,
        tableId: args.tableId,
        fields: snapshot.data.fields,
        version: snapshot.version,
        lastUpdated: snapshot.timestamp,
        source: 'event-store',
      });
    });

    it('should fall back to YAML when snapshot not available', async () => {
      const args = {
        tableId: '68a8ff5237fde0bf797c05b3',
      };

      vi.mocked(mockEventStore.getSnapshot).mockResolvedValue(null);

      const result = await handleKnowledgeFieldMappings(args, mockContext);

      expect(result).toMatchObject({
        success: true,
        tableId: args.tableId,
        source: 'yaml',
      });
      expect(result).toHaveProperty('fields');
    });

    it('should handle circuit breaker open state', async () => {
      const args = {
        tableId: '68a8ff5237fde0bf797c05b3',
      };

      vi.mocked(mockEventStore.getSnapshot).mockRejectedValue(
        new Error('Circuit breaker is OPEN')
      );

      const result = await handleKnowledgeFieldMappings(args, mockContext);

      expect(result).toMatchObject({
        success: true,
        tableId: args.tableId,
        source: 'yaml',
        fallbackReason: 'Circuit breaker is OPEN',
      });
    });
  });

  describe('handleKnowledgeRefreshViews', () => {
    it('should trigger materialized view refresh', async () => {
      const args = {
        views: ['field_mappings'],
      };

      // Mock Supabase client for refresh operation
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      };

      mockContext.supabaseClient = mockSupabaseClient as any;

      const result = await handleKnowledgeRefreshViews(args, mockContext);

      expect(result).toEqual({
        success: true,
        message: 'Views refresh initiated',
        views: args.views,
      });
    });

    it('should handle refresh errors gracefully', async () => {
      const args = {
        views: ['invalid_view'],
      };

      // Mock Supabase client with error
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'View not found' },
        }),
      };

      mockContext.supabaseClient = mockSupabaseClient as any;

      const result = await handleKnowledgeRefreshViews(args, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('View not found'),
      });
    });

    it('should use default views when none specified', async () => {
      const args = {};

      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      };

      mockContext.supabaseClient = mockSupabaseClient as any;

      const result = await handleKnowledgeRefreshViews(args, mockContext);

      expect(result).toEqual({
        success: true,
        message: 'Views refresh initiated',
        views: ['field_mappings'], // Default view
      });
    });
  });

  describe('Error handling', () => {
    it('should handle internal errors gracefully', async () => {
      const args = {
        operation: 'append',
        aggregateId: 'test',
        type: 'test',
        data: {},
      };

      vi.mocked(mockEventStore.append).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await handleKnowledgeEvents(args, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: 'Database connection failed',
      });
    });

  });
});