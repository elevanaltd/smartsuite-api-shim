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
    }

    // Check all fields with validators (both required and optional)
    if (validators) {
      for (const fieldKey of Object.keys(validators)) {
        const field = fieldKey as keyof T;
        const validator = validators[field];
        if (field in args && validator && !validator(args[field as string])) {
          return false;
        }
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

export interface RecordToolArgs extends ToolArguments {
  operation: 'create' | 'update' | 'delete' | 'bulk_update' | 'bulk_delete';
  appId: string;
  recordId?: string;
  data?: Record<string, unknown>;
  dry_run: boolean; // Required for record mutations
}

export const isRecordToolArgs = createToolArgumentGuard<RecordToolArgs>(
  ['operation', 'appId', 'dry_run'],
  {
    operation: (v): v is RecordToolArgs['operation'] =>
      typeof v === 'string' && ['create', 'update', 'delete', 'bulk_update', 'bulk_delete'].includes(v),
    appId: (v): v is string => typeof v === 'string',
    dry_run: (v): v is boolean => typeof v === 'boolean',
    recordId: (v): v is string => v === undefined || typeof v === 'string',
  },
);

export interface SchemaToolArgs {
  appId: string;
  output_mode?: 'summary' | 'fields' | 'detailed';
  [key: string]: unknown;
}

export const isSchemaToolArgs = createToolArgumentGuard<SchemaToolArgs>(
  ['appId'],
  {
    appId: (v): v is string => typeof v === 'string',
    output_mode: (v): v is SchemaToolArgs['output_mode'] =>
      v === undefined || (typeof v === 'string' && ['summary', 'fields', 'detailed'].includes(v)),
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

// ============================================================================
// AUDIT LOG ENTRY GUARDS
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: 'create' | 'update' | 'delete';
  tableId: string;
  recordId: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  beforeData?: Record<string, unknown>;
  reversalInstructions: {
    operation: 'create' | 'update' | 'delete';
    tableId: string;
    recordId?: string;
    payload?: Record<string, unknown>;
  };
  hash: string;
  authContext?: {
    userId: string;
    sessionId: string;
    requestId: string;
    ipAddress: string;
    timestamp: Date;
  };
}

export function isAuditLogEntry(value: unknown): value is AuditLogEntry {
  if (!isObject(value)) return false;

  const entry = value as Record<string, unknown>;

  // Check required fields
  if (typeof entry.id !== 'string') return false;
  if (!(entry.timestamp instanceof Date) && typeof entry.timestamp !== 'string') return false;
  if (!['create', 'update', 'delete'].includes(entry.operation as string)) return false;
  if (typeof entry.tableId !== 'string') return false;
  if (typeof entry.recordId !== 'string') return false;
  if (typeof entry.hash !== 'string') return false;

  // Check reversalInstructions structure
  if (!isObject(entry.reversalInstructions)) return false;
  const reversal = entry.reversalInstructions as Record<string, unknown>;
  if (!['create', 'update', 'delete'].includes(reversal.operation as string)) return false;
  if (typeof reversal.tableId !== 'string') return false;

  // Check optional authContext structure if present
  if (entry.authContext !== undefined) {
    if (!isObject(entry.authContext)) return false;
    const authCtx = entry.authContext as Record<string, unknown>;
    if (typeof authCtx.userId !== 'string') return false;
    if (typeof authCtx.sessionId !== 'string') return false;
    if (typeof authCtx.requestId !== 'string') return false;
    if (typeof authCtx.ipAddress !== 'string') return false;
    if (!(authCtx.timestamp instanceof Date) && typeof authCtx.timestamp !== 'string') return false;
  }

  return true;
}

export function parseAuditLogEntry(jsonString: string): AuditLogEntry | null {
  try {
    const parsed = JSON.parse(jsonString) as unknown;
    if (!isAuditLogEntry(parsed)) return null;

    // Convert string dates to Date objects if needed
    const entry = parsed as AuditLogEntry;
    if (typeof entry.timestamp === 'string') {
      (entry as unknown as Record<string, unknown>).timestamp = new Date(entry.timestamp);
    }
    if (entry.authContext && isObject(entry.authContext)) {
      const authCtx = entry.authContext as unknown as Record<string, unknown>;
      if (typeof authCtx.timestamp === 'string') {
        authCtx.timestamp = new Date(authCtx.timestamp);
      }
    }

    return entry;
  } catch {
    return null;
  }
}
