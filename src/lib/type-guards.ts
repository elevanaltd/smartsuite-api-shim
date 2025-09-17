// GREEN PHASE: Minimal implementation to make RED tests pass
// Test-Methodology-Guardian: TDD RED-GREEN-REFACTOR cycle
// Implementation follows docs/412-DOC-TYPE-SAFETY-PATTERN-DESIGN.md patterns

// ============================================================================
// BASE TYPE GUARDS
// ============================================================================

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ============================================================================
// SMARTSUITE API RESPONSE GUARDS
// ============================================================================

export interface SmartSuiteApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SmartSuiteApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: SmartSuiteApiError;
}

export function isSmartSuiteApiError(value: unknown): value is SmartSuiteApiError {
  if (!isObject(value)) return false;

  const error = value as Record<string, unknown>;
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  );
}

export function isSmartSuiteApiResponse(value: unknown): value is SmartSuiteApiResponse {
  if (!isObject(value)) return false;

  const response = value as Record<string, unknown>;
  return (
    typeof response.success === 'boolean' &&
    (response.data === undefined || isObject(response.data)) &&
    (response.error === undefined || isSmartSuiteApiError(response.error))
  );
}

// ============================================================================
// SMARTSUITE RECORD GUARDS
// ============================================================================

export interface SmartSuiteRecordGuarded {
  id: string;
  application_id: string;
  created_at?: string;
  updated_at?: string;
  [fieldId: string]: unknown; // Dynamic fields
}

export function isSmartSuiteRecord(value: unknown): value is SmartSuiteRecordGuarded {
  if (!isObject(value)) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.application_id === 'string'
  );
}

export function isSmartSuiteRecordArray(value: unknown): value is SmartSuiteRecordGuarded[] {
  return Array.isArray(value) && value.every(isSmartSuiteRecord);
}

export function extractRecordData(
  response: unknown,
): SmartSuiteRecordGuarded | SmartSuiteRecordGuarded[] | null {
  if (isSmartSuiteRecord(response)) return response;
  if (isSmartSuiteRecordArray(response)) return response;

  if (isObject(response)) {
    // Check for paginated response
    const obj = response as Record<string, unknown>;
    if (obj.items && isSmartSuiteRecordArray(obj.items)) {
      return obj.items;
    }
    // Check for single record in data property
    if (obj.data && isSmartSuiteRecord(obj.data)) {
      return obj.data;
    }
  }

  return null;
}

// ============================================================================
// TOOL ARGUMENT GUARDS
// ============================================================================

export interface ToolArguments {
  operation: string;
  appId: string;
  [key: string]: unknown;
}

export function createToolArgumentGuard<T = Record<string, unknown>>(
  requiredFields: (keyof T)[],
  validators?: Partial<Record<keyof T, (value: unknown) => boolean>>,
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    if (!isObject(value)) return false;

    const args = value as Record<string, unknown>;

    // Check required fields exist
    for (const field of requiredFields) {
      if (!(field in args)) return false;

      // Apply field-specific validators if provided
      const validator = validators?.[field];
      if (validator && !validator(args[field as string])) {
        return false;
      }
    }

    return true;
  };
}

export interface QueryToolArgs extends ToolArguments {
  operation: 'list' | 'get' | 'search' | 'count';
  appId: string;
  recordId?: string;
  filters?: Record<string, unknown>;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
}

export const isQueryToolArgs = createToolArgumentGuard<QueryToolArgs>(
  ['operation', 'appId'],
  {
    operation: (v): v is QueryToolArgs['operation'] =>
      typeof v === 'string' && ['list', 'get', 'search', 'count'].includes(v),
    appId: (v): v is string => typeof v === 'string',
    limit: (v): v is number => v === undefined || typeof v === 'number',
    offset: (v): v is number => v === undefined || typeof v === 'number',
  },
);

// ============================================================================
// FILTER GUARDS
// ============================================================================

export interface SmartSuiteFilterField {
  field: string;
  comparison: FilterComparison;
  value: unknown;
}

export type FilterComparison =
  | 'is' | 'is_not'
  | 'contains' | 'not_contains'
  | 'greater_than' | 'less_than'
  | 'has_any_of' | 'has_all_of';

export interface SmartSuiteFilter {
  operator: 'and' | 'or';
  fields: SmartSuiteFilterField[];
}

function isFilterField(value: unknown): value is SmartSuiteFilterField {
  if (!isObject(value)) return false;

  const field = value as Record<string, unknown>;
  return (
    typeof field.field === 'string' &&
    typeof field.comparison === 'string' &&
    field.value !== undefined
  );
}

export function isSmartSuiteFilter(value: unknown): value is SmartSuiteFilter {
  if (!isObject(value)) return false;

  const filter = value as Record<string, unknown>;

  if (!['and', 'or'].includes(filter.operator as string)) return false;
  if (!Array.isArray(filter.fields)) return false;

  return filter.fields.every(isFilterField);
}

function hasComparisonOperator(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj);
  if (keys.length !== 1) return false;

  const validComparisons = [
    'is', 'is_not', 'contains', 'not_contains',
    'greater_than', 'less_than', 'has_any_of', 'has_all_of',
  ];

  const firstKey = keys[0];
  return firstKey !== undefined && validComparisons.includes(firstKey);
}

function isLookupField(fieldName: string, value: unknown): boolean {
  // Lookup fields end with _link and have MongoDB ObjectId values
  if (!fieldName.endsWith('_link')) return false;
  if (typeof value !== 'string') return false;
  return /^[a-f0-9]{24}$/i.test(value);
}

export function transformToSmartSuiteFilter(input: unknown): SmartSuiteFilter | null {
  if (isSmartSuiteFilter(input)) return input;

  if (isObject(input)) {
    const obj = input as Record<string, unknown>;

    // Check if it's already a nested structure
    if ('operator' in obj && 'fields' in obj) {
      if (isSmartSuiteFilter(obj)) return obj;
    }

    // Transform simple object to nested structure
    const fields: SmartSuiteFilterField[] = [];
    for (const [key, value] of Object.entries(obj)) {
      // Handle MongoDB-style comparison objects
      if (isObject(value) && hasComparisonOperator(value)) {
        const compObj = value as Record<string, unknown>;
        const entry = Object.entries(compObj)[0];
        if (entry) {
          const [comparison, compValue] = entry;
          fields.push({
            field: key,
            comparison: comparison as FilterComparison,
            value: isLookupField(key, compValue) ? [compValue] : compValue,
          });
        }
      } else {
        // Simple key-value pair
        fields.push({
          field: key,
          comparison: 'is',
          value: isLookupField(key, value) ? [value] : value,
        });
      }
    }

    return { operator: 'and', fields };
  }

  return null;
}
