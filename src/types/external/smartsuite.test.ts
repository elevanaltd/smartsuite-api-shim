/**
 * Tests for SmartSuite API type definitions and type guards
 */

// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';

import {
  isSmartSuiteRecord,
  isSmartSuiteListResponse,
  isSmartSuiteErrorResponse,
  type SmartSuiteRecord,
  type SmartSuiteField,
  type SmartSuiteTableSchema,
  type SmartSuiteSmartDoc,
} from './smartsuite.js';

describe('SmartSuite Type Guards', () => {
  describe('isSmartSuiteRecord', () => {
    it('should identify valid SmartSuite records', () => {
      const validRecord = {
        id: 'rec123',
        field1: 'value1',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(isSmartSuiteRecord(validRecord)).toBe(true);
    });

    it('should reject invalid records', () => {
      expect(isSmartSuiteRecord(null)).toBe(false);
      expect(isSmartSuiteRecord(undefined)).toBe(false);
      expect(isSmartSuiteRecord({})).toBe(false); // Missing id
      expect(isSmartSuiteRecord({ id: 123 })).toBe(false); // Wrong id type
      expect(isSmartSuiteRecord('not an object')).toBe(false);
    });
  });

  describe('isSmartSuiteListResponse', () => {
    it('should identify valid list responses', () => {
      const validResponse = {
        items: [{ id: 'rec1' }, { id: 'rec2' }],
        total_count: 2,
        has_more: false,
      };

      expect(isSmartSuiteListResponse(validResponse)).toBe(true);
    });

    it('should reject invalid list responses', () => {
      expect(isSmartSuiteListResponse(null)).toBe(false);
      expect(isSmartSuiteListResponse({})).toBe(false);
      expect(isSmartSuiteListResponse({ items: 'not an array' })).toBe(false);
      expect(isSmartSuiteListResponse({ items: [], total_count: 'not a number' })).toBe(false);
    });
  });

  describe('isSmartSuiteErrorResponse', () => {
    it('should identify valid error responses', () => {
      const validError = {
        error: {
          code: 'INVALID_FIELD',
          message: 'Field not found',
        },
      };

      expect(isSmartSuiteErrorResponse(validError)).toBe(true);
    });

    it('should reject invalid error responses', () => {
      expect(isSmartSuiteErrorResponse(null)).toBe(false);
      expect(isSmartSuiteErrorResponse({})).toBe(false);
      expect(isSmartSuiteErrorResponse({ error: 'not an object' })).toBe(false);
    });
  });
});

describe('SmartSuite Type Definitions', () => {
  it('should allow valid field definitions', () => {
    const field: SmartSuiteField = {
      id: 'fld123',
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      options: [
        { id: 'opt1', label: 'Active' },
        { id: 'opt2', label: 'Inactive' },
      ],
    };

    expect(field.type).toBe('select');
  });

  it('should allow valid table schema', () => {
    const schema: SmartSuiteTableSchema = {
      id: 'tbl123',
      name: 'Projects',
      slug: 'projects',
      fields: [
        {
          id: 'fld1',
          name: 'name',
          type: 'text',
          label: 'Project Name',
        },
      ],
    };

    expect(schema.fields).toHaveLength(1);
  });

  it('should allow valid SmartDoc checklist structure', () => {
    const checklist: SmartSuiteSmartDoc = {
      type: 'doc',
      content: [
        {
          type: 'checklist',
          content: [
            {
              type: 'checklist_item',
              content: [
                {
                  type: 'text',
                  text: 'Task 1',
                },
              ],
              attrs: {
                checked: false,
              },
            },
          ],
        },
      ],
    };

    expect(checklist.content[0]?.type).toBe('checklist');
  });
});

describe('Type Safety', () => {
  it('should enforce proper types for record fields', () => {
    const record: SmartSuiteRecord = {
      id: 'rec123',
      status: 'active', // unknown type is allowed
      count: 42,
      tags: ['tag1', 'tag2'],
    };

    // Type system should allow accessing these fields
    expect(record.id).toBe('rec123');
    expect(record['status']).toBe('active');
  });

  it('should handle linked record arrays', () => {
    const record: SmartSuiteRecord = {
      id: 'rec123',
      linked_records: [
        { record_id: 'rec456', display_value: 'Related Item' },
      ],
    };

    expect(Array.isArray(record.linked_records)).toBe(true);
  });
});
