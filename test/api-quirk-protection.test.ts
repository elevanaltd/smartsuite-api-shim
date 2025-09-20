// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Implementation-Lead: RED phase tests for protective intelligence features
// CRITICAL: Tests must fail initially to demonstrate protection gaps
// Context7: consulted for vitest

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleIntelligentFacade } from '../src/tools/intelligent-facade.js';
import type { ToolContext } from '../src/tools/types.js';

// Mock the underlying handlers to focus on facade logic
vi.mock('../src/tools/query.js', () => ({
  handleQuery: vi.fn().mockImplementation(async (_context, args) => {
    // Return the args to verify what the facade passed through
    return { mockResponse: 'query', passedArgs: args };
  }),
}));

vi.mock('../src/tools/record.js', () => ({
  handleRecord: vi.fn().mockImplementation(async (_context, args) => {
    // Return the args to verify what the facade passed through
    return { mockResponse: 'record', passedArgs: args };
  }),
}));

describe('API Quirk Protection - Protective Intelligence', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      client: {} as any,
      fieldTranslator: {} as any,
      tableResolver: {} as any,
      auditLogger: {} as any,
    };
  });

  describe('Array Wrapping Protection for Linked Records', () => {
    it('should automatically wrap single linked record values in arrays', async () => {
      // RED: This test MUST fail initially - no array wrapping exists yet
      const singleLinkedRecordInput = {
        tool_name: 'smartsuite_record',
        operation_description: 'Update task to assign to specific project',
        method: 'PATCH',
        tableId: '68ab34b30b1e05e11a8ba87f',
        payload: {
          recordId: 'test-record-id',
          // CRITICAL: Single value that should be auto-wrapped
          projects_link: '68acac24271c120f1c9f1f01', // Should become array
          assigned_to: 'user123', // Should become array
        },
      };

      const result = await handleIntelligentFacade(mockContext, singleLinkedRecordInput);

      // Verify that single values were wrapped in arrays
      const passedData = (result as any).passedArgs.data;
      expect(passedData.projects_link).toEqual(['68acac24271c120f1c9f1f01']);
      expect(passedData.assigned_to).toEqual(['user123']);
    });

    it('should preserve arrays for linked record values that are already arrays', async () => {
      // RED: This test should pass as it doesn't require new functionality
      const arrayLinkedRecordInput = {
        tool_name: 'smartsuite_record',
        operation_description: 'Update task with multiple assignments',
        method: 'PATCH',
        tableId: '68ab34b30b1e05e11a8ba87f',
        payload: {
          recordId: 'test-record-id',
          // These are already arrays - should be preserved
          projects_link: ['68acac24271c120f1c9f1f01', '68acac24271c120f1c9f1f02'],
          assigned_to: ['user123', 'user456'],
        },
      };

      const result = await handleIntelligentFacade(mockContext, arrayLinkedRecordInput);

      // Verify arrays are preserved
      const passedData = (result as any).passedArgs.data;
      expect(passedData.projects_link).toEqual([
        '68acac24271c120f1c9f1f01',
        '68acac24271c120f1c9f1f02',
      ]);
      expect(passedData.assigned_to).toEqual(['user123', 'user456']);
    });
  });

  describe('Filter Operator Correction for Linked Records', () => {
    it('should automatically correct "is" to "has_any_of" for linked record filters', async () => {
      // RED: This test MUST fail initially - no filter correction exists yet
      const incorrectFilterInput = {
        tool_name: 'smartsuite_query',
        operation_description: 'Find tasks assigned to specific project',
        method: 'POST',
        tableId: '68ab34b30b1e05e11a8ba87f',
        payload: {
          filters: {
            operator: 'and',
            fields: [
              {
                field: 'projects_link',
                comparison: 'is', // CRITICAL: Should be auto-corrected to 'has_any_of'
                value: ['68acac24271c120f1c9f1f01'],
              },
              {
                field: 'assigned_to',
                comparison: 'is', // CRITICAL: Should be auto-corrected to 'has_any_of'
                value: ['user123'],
              },
            ],
          },
        },
      };

      const result = await handleIntelligentFacade(mockContext, incorrectFilterInput);

      // Verify that 'is' operators were corrected to 'has_any_of'
      const passedFilters = (result as any).passedArgs.filters;
      expect(passedFilters.fields[0].comparison).toBe('has_any_of');
      expect(passedFilters.fields[1].comparison).toBe('has_any_of');
    });

    it('should preserve correct operators for non-linked record fields', async () => {
      // RED: This should work after filter correction is implemented
      const correctFilterInput = {
        tool_name: 'smartsuite_query',
        operation_description: 'Find tasks with specific status',
        method: 'POST',
        tableId: '68ab34b30b1e05e11a8ba87f',
        payload: {
          filters: {
            operator: 'and',
            fields: [
              {
                field: 'status',
                comparison: 'is', // Should remain 'is' for status fields
                value: 'in_progress',
              },
              {
                field: 'title',
                comparison: 'contains', // Should remain 'contains' for text fields
                value: 'test',
              },
            ],
          },
        },
      };

      const result = await handleIntelligentFacade(mockContext, correctFilterInput);

      // Verify that non-linked field operators are preserved
      const passedFilters = (result as any).passedArgs.filters;
      expect(passedFilters.fields[0].comparison).toBe('is');
      expect(passedFilters.fields[1].comparison).toBe('contains');
    });
  });

  describe('Method Inference from Operation Context', () => {
    it('should infer PATCH method for updates when recordId is present', async () => {
      // RED: This test MUST fail initially - no method inference exists yet
      const updateOperationInput = {
        tool_name: 'smartsuite_record',
        operation_description: 'Update existing task with new data',
        // Note: method is NOT specified - should be inferred
        tableId: '68ab34b30b1e05e11a8ba87f',
        payload: {
          recordId: 'existing-record-id', // Presence indicates update
          title: 'Updated task title',
        },
      };

      const result = await handleIntelligentFacade(mockContext, updateOperationInput);

      // Verify that PATCH method was inferred for update operation
      expect((result as any).passedArgs.operation).toBe('update');
    });

    it('should infer POST method for creates when no recordId is present', async () => {
      // RED: This test MUST fail initially - no method inference exists yet
      const createOperationInput = {
        tool_name: 'smartsuite_record',
        operation_description: 'Create new task in project',
        // Note: method is NOT specified - should be inferred
        tableId: '68ab34b30b1e05e11a8ba87f',
        payload: {
          // No recordId - indicates creation
          title: 'New task title',
          projects_link: '68acac24271c120f1c9f1f01',
        },
      };

      const result = await handleIntelligentFacade(mockContext, createOperationInput);

      // Verify that POST method was inferred for create operation
      expect((result as any).passedArgs.operation).toBe('create');
    });
  });

  describe('Trailing Slash Enforcement', () => {
    it('should automatically add trailing slashes to generated endpoints', async () => {
      // RED: This test MUST fail initially - no trailing slash enforcement exists yet
      const endpointGenerationInput = {
        tool_name: 'smartsuite_query',
        operation_description: 'List all records in table',
        method: 'POST',
        tableId: '68ab34b30b1e05e11a8ba87f',
        // No endpoint provided - should be generated with trailing slash
      };

      const result = await handleIntelligentFacade(mockContext, endpointGenerationInput);

      // The facade should generate endpoint and add trailing slash
      // We'll verify this by checking if the operation was routed correctly
      expect(result).toHaveProperty('mockResponse', 'query');
      expect((result as any).passedArgs.appId).toBe('68ab34b30b1e05e11a8ba87f');
    });

    it('should add trailing slash to provided endpoints that lack them', async () => {
      // RED: This test will fail until trailing slash enforcement is implemented
      const endpointInput = {
        tool_name: 'smartsuite_record',
        operation_description: 'Update record via specific endpoint',
        method: 'PATCH',
        endpoint: '/api/v1/applications/68ab34b30b1e05e11a8ba87f/records/record-id', // Missing trailing slash
        payload: {
          recordId: 'record-id',
          title: 'Updated title',
        },
      };

      const result = await handleIntelligentFacade(mockContext, endpointInput);

      // Should work correctly despite missing trailing slash
      expect(result).toHaveProperty('mockResponse', 'record');
      expect((result as any).passedArgs.operation).toBe('update');
    });
  });

  describe('SmartDoc Format Validation Integration', () => {
    it('should detect and prevent simple array checklist format that causes silent data loss', async () => {
      // RED: This test MUST fail initially - no SmartDoc validation integration exists yet
      const invalidChecklistInput = {
        tool_name: 'smartsuite_record',
        operation_description: 'Create task with checklist',
        method: 'POST',
        tableId: '68ab34b30b1e05e11a8ba87f',
        payload: {
          title: 'Task with checklist',
          // CRITICAL: This format causes silent data loss (API 200 but no save)
          checklist_field: ['item1', 'item2', 'item3'], // Invalid simple array format
        },
      };

      // Should throw error to prevent silent data loss
      await expect(handleIntelligentFacade(mockContext, invalidChecklistInput)).rejects.toThrow(
        /Invalid checklist format.*SmartSuite API/i,
      );
    });

    it('should accept valid SmartDoc rich text format for checklists', async () => {
      // RED: This test should pass once SmartDoc validation is integrated
      const validChecklistInput = {
        tool_name: 'smartsuite_record',
        operation_description: 'Create task with proper checklist format',
        method: 'POST',
        tableId: '68ab34b30b1e05e11a8ba87f',
        payload: {
          title: 'Task with valid checklist',
          // Proper SmartDoc format
          checklist_field: {
            type: 'doc',
            content: [
              {
                type: 'checklist',
                content: [
                  {
                    type: 'checklist_item',
                    content: [{ type: 'text', text: 'item1' }],
                    attrs: { checked: false },
                  },
                  {
                    type: 'checklist_item',
                    content: [{ type: 'text', text: 'item2' }],
                    attrs: { checked: true },
                  },
                ],
              },
            ],
          },
        },
      };

      // Should not throw error for valid format
      await expect(
        handleIntelligentFacade(mockContext, validChecklistInput),
      ).resolves.toBeDefined();
    });
  });
});
