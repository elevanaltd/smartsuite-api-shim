/**
 * Filter validation utility for SmartSuite API
 * Provides pre-flight validation and helpful error messages
 */

export interface FilterField {
  field: string;
  comparison: string;
  value?: unknown;
}

export interface Filter {
  operator?: 'and' | 'or';
  fields?: FilterField[];
}

export class FilterValidator {
  /**
   * Validate filter structure before sending to API
   * Returns null if valid, or error message if invalid
   */
  static validate(filter: unknown): string | null {
    if (!filter) return null;
    
    if (typeof filter !== 'object') {
      return 'Filter must be an object';
    }
    
    const filterObj = filter as Record<string, unknown>;
    
    // Check for required operator
    if ('fields' in filterObj && !('operator' in filterObj)) {
      return 'Filter with fields array must have an operator (and/or)';
    }
    
    // Validate operator
    if ('operator' in filterObj) {
      const operator = filterObj.operator;
      if (operator !== 'and' && operator !== 'or') {
        return `Invalid operator "${operator}" - must be "and" or "or"`;
      }
    }
    
    // Validate fields array
    if ('fields' in filterObj) {
      if (!Array.isArray(filterObj.fields)) {
        return 'Filter fields must be an array';
      }
      
      for (let i = 0; i < filterObj.fields.length; i++) {
        const field = filterObj.fields[i];
        const fieldError = this.validateField(field, i);
        if (fieldError) return fieldError;
      }
    }
    
    return null;
  }
  
  private static validateField(field: unknown, index: number): string | null {
    if (!field || typeof field !== 'object') {
      return `Field at index ${index} must be an object`;
    }
    
    const fieldObj = field as Record<string, unknown>;
    
    // Check required properties
    if (!('field' in fieldObj)) {
      return `Field at index ${index} missing required property "field"`;
    }
    
    if (!('comparison' in fieldObj)) {
      return `Field at index ${index} missing required property "comparison"`;
    }
    
    // Validate comparison operator
    const validComparisons = [
      'is', 'is_not', 'contains', 'not_contains',
      'is_empty', 'is_not_empty', 'greater_than', 'less_than',
      'greater_than_or_equal', 'less_than_or_equal',
      'between', 'not_between'
    ];
    
    const comparison = String(fieldObj.comparison);
    if (!validComparisons.includes(comparison)) {
      return `Field at index ${index} has invalid comparison "${comparison}"`;
    }
    
    // Validate value based on comparison
    if (comparison !== 'is_empty' && comparison !== 'is_not_empty') {
      if (!('value' in fieldObj)) {
        return `Field at index ${index} with comparison "${comparison}" requires a value`;
      }
    }
    
    return null;
  }
  
  /**
   * Format filter for better debugging
   */
  static format(filter: unknown): string {
    try {
      return JSON.stringify(filter, null, 2);
    } catch {
      return String(filter);
    }
  }
}