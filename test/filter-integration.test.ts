// Context7: consulted for vitest
import { describe, it, expect, vi } from 'vitest';

import { createAuthenticatedClient } from '../src/smartsuite-client.js';

describe('Filter Integration Tests', () => {
  it('should transform simple filters before sending to API', async () => {
    // Mock fetch to capture the actual request
    let capturedRequestBody: any;
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      capturedRequestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ items: [], total: 0, offset: 0, limit: 200 }),
      };
    });

    const client = new SmartSuiteClient();
    
    // Test simple filter transformation
    await client.listRecords('test-app-id', {
      filter: { autonumber: 'EAV007' },
    });

    // Verify the filter was transformed to nested structure
    expect(capturedRequestBody.filter).toEqual({
      operator: 'and',
      fields: [
        { field: 'autonumber', comparison: 'is', value: 'EAV007' },
      ],
    });
  });

  it('should transform lookup field values to arrays', async () => {
    let capturedRequestBody: any;
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      capturedRequestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ items: [], total: 0, offset: 0, limit: 200 }),
      };
    });

    const client = new SmartSuiteClient();
    
    // Test lookup field transformation
    await client.listRecords('test-app-id', {
      filter: { 
        projects_link: '68abcd3975586ee1ff3e5b1f',
        autonumber: 'EAV007',
      },
    });

    // Verify lookup field values are arrays
    expect(capturedRequestBody.filter).toEqual({
      operator: 'and',
      fields: [
        { field: 'projects_link', comparison: 'is', value: ['68abcd3975586ee1ff3e5b1f'] },
        { field: 'autonumber', comparison: 'is', value: 'EAV007' },
      ],
    });
  });

  it('should pass through already-nested filters unchanged', async () => {
    let capturedRequestBody: any;
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      capturedRequestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ items: [], total: 0, offset: 0, limit: 200 }),
      };
    });

    const client = new SmartSuiteClient();
    
    const nestedFilter = {
      operator: 'or' as const,
      fields: [
        { field: 'status', comparison: 'is', value: 'active' },
        { field: 'priority', comparison: 'greater_than', value: 5 },
      ],
    };
    
    await client.listRecords('test-app-id', {
      filter: nestedFilter,
    });

    // Verify nested filters pass through unchanged
    expect(capturedRequestBody.filter).toEqual(nestedFilter);
  });

  it('should work with count operations', async () => {
    let capturedRequestBody: any;
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      capturedRequestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ total: 42 }),
      };
    });

    const client = new SmartSuiteClient();
    
    // Test count with simple filter
    const result = await client.countRecords('test-app-id', {
      filter: { status: 'active' },
    });

    // Verify transformation worked for count operation
    expect(capturedRequestBody.filter).toEqual({
      operator: 'and',
      fields: [
        { field: 'status', comparison: 'is', value: 'active' },
      ],
    });
    expect(result).toBe(42);
  });
});