// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';

import { FilterValidator } from '../src/lib/filter-validator.js';

describe('SmartSuite API Filtering', () => {
  describe('Filter Transformation', () => {
    it('should transform simple object filters to nested structure', () => {
      // FAILING TEST: Simple filter objects should be transformed to nested structure
      const simpleFilter = { autonumber: 'EAV007' };

      const transformed = FilterValidator.transformFilter(simpleFilter);

      // Expected nested structure per SmartSuite API docs
      expect(transformed).toEqual({
        operator: 'and',
        fields: [
          { field: 'autonumber', comparison: 'is', value: 'EAV007' },
        ],
      });
    });

    it('should transform multiple field filters to nested structure', () => {
      const simpleFilter = {
        autonumber: 'EAV007',
        status: 'active',
      };

      const transformed = FilterValidator.transformFilter(simpleFilter);

      expect(transformed).toEqual({
        operator: 'and',
        fields: [
          { field: 'autonumber', comparison: 'is', value: 'EAV007' },
          { field: 'status', comparison: 'is', value: 'active' },
        ],
      });
    });

    it('should handle lookup field values as arrays', () => {
      const simpleFilter = {
        projects_link: '68abcd3975586ee1ff3e5b1f',
        autonumber: 'EAV007',
      };

      const transformed = FilterValidator.transformFilter(simpleFilter);

      expect(transformed).toEqual({
        operator: 'and',
        fields: [
          { field: 'projects_link', comparison: 'is', value: ['68abcd3975586ee1ff3e5b1f'] },
          { field: 'autonumber', comparison: 'is', value: 'EAV007' },
        ],
      });
    });

    it('should pass through already-nested filters unchanged', () => {
      const nestedFilter = {
        operator: 'or',
        fields: [
          { field: 'status', comparison: 'is', value: 'active' },
          { field: 'priority', comparison: 'greater_than', value: 5 },
        ],
      };

      const transformed = FilterValidator.transformFilter(nestedFilter);

      // Should return the same object for already-nested filters
      expect(transformed).toEqual(nestedFilter);
    });

    it('should handle cryptic field codes from API', () => {
      const simpleFilter = {
        sb22aa25c1: 'EAV007', // Cryptic field code
        sc33bb44d2: 'active',
      };

      const transformed = FilterValidator.transformFilter(simpleFilter);

      expect(transformed).toEqual({
        operator: 'and',
        fields: [
          { field: 'sb22aa25c1', comparison: 'is', value: 'EAV007' },
          { field: 'sc33bb44d2', comparison: 'is', value: 'active' },
        ],
      });
    });

    it('should identify lookup fields by pattern and convert values to arrays', () => {
      const simpleFilter = {
        project_link: '68abcd3975586ee1ff3e5b1f',
        client_link: '78efgh4086597ff2gg4f6c2g',
        regular_field: 'simple_value',
      };

      const transformed = FilterValidator.transformFilter(simpleFilter);

      expect(transformed).toEqual({
        operator: 'and',
        fields: [
          { field: 'project_link', comparison: 'is', value: ['68abcd3975586ee1ff3e5b1f'] },
          { field: 'client_link', comparison: 'is', value: ['78efgh4086597ff2gg4f6c2g'] },
          { field: 'regular_field', comparison: 'is', value: 'simple_value' },
        ],
      });
    });

    it('should handle null and undefined filters', () => {
      expect(FilterValidator.transformFilter(null)).toBeNull();
      expect(FilterValidator.transformFilter(undefined)).toBeUndefined();
    });

    it('should validate transformed filters', () => {
      const simpleFilter = { autonumber: 'EAV007' };

      const transformed = FilterValidator.transformFilter(simpleFilter);
      const validationError = FilterValidator.validate(transformed);

      expect(validationError).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should demonstrate the 400 Bad Request issue with simple filters', () => {
      // This test documents the current issue where simple filters cause 400 errors
      const problematicFilter = { autonumber: 'EAV007' };

      // The filter transformation should prevent 400 errors by converting to proper structure
      const transformedFilter = FilterValidator.transformFilter(problematicFilter);

      // Verify the transformation produces the expected SmartSuite API format
      expect(transformedFilter).toHaveProperty('operator', 'and');
      expect(transformedFilter).toHaveProperty('fields');
      expect((transformedFilter as any).fields).toHaveLength(1);
      expect((transformedFilter as any).fields[0]).toEqual({
        field: 'autonumber',
        comparison: 'is',
        value: 'EAV007',
      });
    });
  });
});
