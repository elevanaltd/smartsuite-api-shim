// RED PHASE: Failing tests for type guards foundation library
// Test-Methodology-Guardian: TDD RED-GREEN-REFACTOR cycle enforcement
// Following docs/412-DOC-TYPE-SAFETY-PATTERN-DESIGN.md patterns
// Context7: consulted for vitest

import { describe, it, expect } from 'vitest';

import {
  isObject,
  isSmartSuiteApiResponse,
  isSmartSuiteApiError,
  isSmartSuiteRecord,
  isSmartSuiteRecordArray,
  extractRecordData,
  createToolArgumentGuard,
  isQueryToolArgs,
  isRecordToolArgs,
  isSchemaToolArgs,
  isSmartSuiteFilter,
  transformToSmartSuiteFilter,
  type SmartSuiteApiResponse,
  type SmartSuiteRecordGuarded,
  type QueryToolArgs,
  type RecordToolArgs,
  type SchemaToolArgs,
  type SmartSuiteFilter,
} from './type-guards.js';

describe('Base Type Guards', () => {
  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject([])).toBe(false);
    });
  });
});

describe('SmartSuite API Response Guards', () => {
  describe('isSmartSuiteApiError', () => {
    it('should validate valid error objects', () => {
      const validError = {
        code: 'VALIDATION_ERROR',
        message: 'Field validation failed',
        details: { field: 'name' },
      };
      expect(isSmartSuiteApiError(validError)).toBe(true);
    });

    it('should reject invalid error objects', () => {
      expect(isSmartSuiteApiError({})).toBe(false);
      expect(isSmartSuiteApiError({ code: 123 })).toBe(false);
      expect(isSmartSuiteApiError({ message: 'error' })).toBe(false);
      expect(isSmartSuiteApiError(null)).toBe(false);
    });
  });

  describe('isSmartSuiteApiResponse', () => {
    it('should validate successful response', () => {
      const response: SmartSuiteApiResponse = {
        success: true,
        data: { id: '123', application_id: 'app123' },
      };
      expect(isSmartSuiteApiResponse(response)).toBe(true);
    });

    it('should validate error response', () => {
      const response: SmartSuiteApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Record not found',
        },
      };
      expect(isSmartSuiteApiResponse(response)).toBe(true);
    });

    it('should reject invalid responses', () => {
      expect(isSmartSuiteApiResponse({})).toBe(false);
      expect(isSmartSuiteApiResponse({ success: 'true' })).toBe(false);
      expect(isSmartSuiteApiResponse(null)).toBe(false);
    });
  });
});

describe('SmartSuite Record Guards', () => {
  describe('isSmartSuiteRecord', () => {
    it('should validate valid records', () => {
      const record: SmartSuiteRecordGuarded = {
        id: '64f8b12e5c7d8a9b1234567',
        application_id: '68a8ff5237fde0bf797c05b3',
        created_at: '2023-09-06T10:30:00Z',
        updated_at: '2023-09-06T10:30:00Z',
        s47d2a1b: 'Task Title',
        s47d2a1c: ['In Progress'],
      };
      expect(isSmartSuiteRecord(record)).toBe(true);
    });

    it('should reject invalid records', () => {
      expect(isSmartSuiteRecord({})).toBe(false);
      expect(isSmartSuiteRecord({ id: 123 })).toBe(false);
      expect(isSmartSuiteRecord({ application_id: 'app' })).toBe(false);
      expect(isSmartSuiteRecord(null)).toBe(false);
    });
  });

  describe('isSmartSuiteRecordArray', () => {
    it('should validate array of valid records', () => {
      const records = [
        { id: '1', application_id: 'app1' },
        { id: '2', application_id: 'app2' },
      ];
      expect(isSmartSuiteRecordArray(records)).toBe(true);
    });

    it('should reject arrays with invalid records', () => {
      const invalidRecords = [
        { id: '1', application_id: 'app1' },
        { invalid: 'record' },
      ];
      expect(isSmartSuiteRecordArray(invalidRecords)).toBe(false);
      expect(isSmartSuiteRecordArray([])).toBe(true); // Empty array is valid
    });
  });

  describe('extractRecordData', () => {
    it('should extract single record', () => {
      const record = { id: '1', application_id: 'app1' };
      expect(extractRecordData(record)).toEqual(record);
    });

    it('should extract record array', () => {
      const records = [{ id: '1', application_id: 'app1' }];
      expect(extractRecordData(records)).toEqual(records);
    });

    it('should extract from paginated response', () => {
      const response = {
        items: [{ id: '1', application_id: 'app1' }],
        total: 1,
        offset: 0,
        limit: 10,
      };
      expect(extractRecordData(response)).toEqual(response.items);
    });

    it('should extract from data property', () => {
      const response = {
        data: { id: '1', application_id: 'app1' },
      };
      expect(extractRecordData(response)).toEqual(response.data);
    });

    it('should return null for invalid data', () => {
      expect(extractRecordData(null)).toBe(null);
      expect(extractRecordData('invalid')).toBe(null);
      expect(extractRecordData({ invalid: 'data' })).toBe(null);
    });
  });
});

describe('Tool Argument Guards', () => {
  describe('createToolArgumentGuard', () => {
    interface TestToolArgs {
      operation: string;
      appId: string;
      optional?: number;
    }

    it('should create guard that validates required fields', () => {
      const guard = createToolArgumentGuard<TestToolArgs>(['operation', 'appId']);

      expect(guard({ operation: 'test', appId: 'app123' })).toBe(true);
      expect(guard({ operation: 'test' })).toBe(false);
      expect(guard({ appId: 'app123' })).toBe(false);
      expect(guard({})).toBe(false);
    });

    it('should use field validators when provided', () => {
      const guard = createToolArgumentGuard<TestToolArgs>(
        ['operation', 'appId'],
        {
          operation: (v) => typeof v === 'string' && v.length > 0,
          appId: (v) => typeof v === 'string' && v.length === 24,
        },
      );

      expect(guard({ operation: 'test', appId: '68a8ff5237fde0bf797c05b3' })).toBe(true);
      expect(guard({ operation: '', appId: '68a8ff5237fde0bf797c05b3' })).toBe(false);
      expect(guard({ operation: 'test', appId: 'short' })).toBe(false);
    });
  });

  describe('isQueryToolArgs', () => {
    it('should validate valid query arguments', () => {
      const args: QueryToolArgs = {
        operation: 'list',
        appId: '68a8ff5237fde0bf797c05b3',
        limit: 10,
        offset: 0,
      };
      expect(isQueryToolArgs(args)).toBe(true);
    });

    it('should validate required fields only', () => {
      const args = {
        operation: 'get',
        appId: '68a8ff5237fde0bf797c05b3',
      };
      expect(isQueryToolArgs(args)).toBe(true);
    });

    it('should reject invalid operations', () => {
      const args = {
        operation: 'invalid',
        appId: '68a8ff5237fde0bf797c05b3',
      };
      expect(isQueryToolArgs(args)).toBe(false);
    });

    it('should reject missing required fields', () => {
      expect(isQueryToolArgs({ operation: 'list' })).toBe(false);
      expect(isQueryToolArgs({ appId: '123' })).toBe(false);
    });
  });

  describe('isRecordToolArgs', () => {
    it('should validate valid record arguments', () => {
      const args: RecordToolArgs = {
        operation: 'create',
        appId: '68a8ff5237fde0bf797c05b3',
        dry_run: true,
        data: { name: 'Test Record' },
      };
      expect(isRecordToolArgs(args)).toBe(true);
    });

    it('should validate required fields only', () => {
      const args = {
        operation: 'delete',
        appId: '68a8ff5237fde0bf797c05b3',
        dry_run: false,
        recordId: '64f8b12e5c7d8a9b12345678',
      };
      expect(isRecordToolArgs(args)).toBe(true);
    });

    it('should reject invalid operations', () => {
      const args = {
        operation: 'invalid',
        appId: '68a8ff5237fde0bf797c05b3',
        dry_run: true,
      };
      expect(isRecordToolArgs(args)).toBe(false);
    });

    it('should reject missing required fields', () => {
      expect(isRecordToolArgs({ operation: 'create', appId: '123' })).toBe(false); // missing dry_run
      expect(isRecordToolArgs({ operation: 'create', dry_run: true })).toBe(false); // missing appId
      expect(isRecordToolArgs({ appId: '123', dry_run: true })).toBe(false); // missing operation
    });

    it('should reject invalid dry_run type', () => {
      const args = {
        operation: 'create',
        appId: '68a8ff5237fde0bf797c05b3',
        dry_run: 'true', // string instead of boolean
      };
      expect(isRecordToolArgs(args)).toBe(false);
    });
  });

  describe('isSchemaToolArgs', () => {
    it('should validate valid schema arguments', () => {
      const args: SchemaToolArgs = {
        appId: '68a8ff5237fde0bf797c05b3',
        output_mode: 'detailed',
      };
      expect(isSchemaToolArgs(args)).toBe(true);
    });

    it('should validate required fields only', () => {
      const args = {
        appId: '68a8ff5237fde0bf797c05b3',
        // output_mode is optional
      };
      expect(isSchemaToolArgs(args)).toBe(true);
    });

    it('should reject invalid output_mode', () => {
      const args = {
        appId: '68a8ff5237fde0bf797c05b3',
        output_mode: 'invalid',
      };
      expect(isSchemaToolArgs(args)).toBe(false);
    });

    it('should accept valid output_mode values', () => {
      const validModes = ['summary', 'fields', 'detailed'];
      for (const mode of validModes) {
        const args = {
          appId: '68a8ff5237fde0bf797c05b3',
          output_mode: mode,
        };
        expect(isSchemaToolArgs(args)).toBe(true);
      }
    });

    it('should reject missing required fields', () => {
      expect(isSchemaToolArgs({})).toBe(false); // missing appId
      expect(isSchemaToolArgs({ output_mode: 'summary' })).toBe(false); // missing appId
    });
  });
});

describe('Filter Guards', () => {
  describe('isSmartSuiteFilter', () => {
    it('should validate valid filter structure', () => {
      const filter: SmartSuiteFilter = {
        operator: 'and',
        fields: [
          {
            field: 's47d2a1b',
            comparison: 'contains',
            value: 'test',
          },
        ],
      };
      expect(isSmartSuiteFilter(filter)).toBe(true);
    });

    it('should reject invalid operators', () => {
      const filter = {
        operator: 'invalid',
        fields: [],
      };
      expect(isSmartSuiteFilter(filter)).toBe(false);
    });

    it('should reject non-array fields', () => {
      const filter = {
        operator: 'and',
        fields: 'not-array',
      };
      expect(isSmartSuiteFilter(filter)).toBe(false);
    });

    it('should reject invalid field objects', () => {
      const filter = {
        operator: 'and',
        fields: [{ invalid: 'field' }],
      };
      expect(isSmartSuiteFilter(filter)).toBe(false);
    });
  });

  describe('transformToSmartSuiteFilter', () => {
    it('should pass through valid filters unchanged', () => {
      const filter: SmartSuiteFilter = {
        operator: 'and',
        fields: [
          { field: 's47d2a1b', comparison: 'is', value: 'test' },
        ],
      };
      expect(transformToSmartSuiteFilter(filter)).toEqual(filter);
    });

    it('should transform simple object to filter', () => {
      const input = { status: 'active', priority: 'high' };
      const expected: SmartSuiteFilter = {
        operator: 'and',
        fields: [
          { field: 'status', comparison: 'is', value: 'active' },
          { field: 'priority', comparison: 'is', value: 'high' },
        ],
      };
      expect(transformToSmartSuiteFilter(input)).toEqual(expected);
    });

    it('should handle MongoDB-style comparison operators', () => {
      const input = {
        age: { greater_than: 18 },
        name: { contains: 'john' },
      };
      const expected: SmartSuiteFilter = {
        operator: 'and',
        fields: [
          { field: 'age', comparison: 'greater_than', value: 18 },
          { field: 'name', comparison: 'contains', value: 'john' },
        ],
      };
      expect(transformToSmartSuiteFilter(input)).toEqual(expected);
    });

    it('should handle lookup fields with array wrapping', () => {
      const input = { assigned_user_link: '64f8b12e5c7d8a9b12345678' };
      const expected: SmartSuiteFilter = {
        operator: 'and',
        fields: [
          {
            field: 'assigned_user_link',
            comparison: 'is',
            value: ['64f8b12e5c7d8a9b12345678'],
          },
        ],
      };
      expect(transformToSmartSuiteFilter(input)).toEqual(expected);
    });

    it('should return null for invalid input', () => {
      expect(transformToSmartSuiteFilter(null)).toBe(null);
      expect(transformToSmartSuiteFilter('string')).toBe(null);
      expect(transformToSmartSuiteFilter(123)).toBe(null);
    });
  });
});
