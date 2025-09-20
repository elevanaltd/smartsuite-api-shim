/**
 * SmartSuite API Response Type Definitions
 *
 * Critical-Engineer: consulted for External service integrations (third-party APIs, webhooks)
 * These types provide runtime-validated boundaries for SmartSuite API responses
 * to eliminate unsafe 'any' types throughout the codebase.
 */

/**
 * SmartSuite Field Types
 */
export type SmartSuiteFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'linkedrecord'
  | 'formula'
  | 'autonumber'
  | 'user'
  | 'file'
  | 'url'
  | 'email'
  | 'phone'
  | 'currency'
  | 'percentage'
  | 'rating'
  | 'checklist'
  | 'address'
  | 'smartdoc';

/**
 * SmartSuite Field Definition
 */
export interface SmartSuiteField {
  id: string;
  name: string;
  type: SmartSuiteFieldType;
  label: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  options?: Array<{
    id: string;
    label: string;
    color?: string;
  }>;
  linkedTable?: string;
  formula?: string;
  format?: string;
  min?: number;
  max?: number;
  precision?: number;
  allowMultiple?: boolean;
}

/**
 * SmartSuite Table/Application Schema
 */
export interface SmartSuiteTableSchema {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  fields: SmartSuiteField[];
  views?: SmartSuiteView[];
  createdAt?: string;
  updatedAt?: string;
  recordCount?: number;
}

/**
 * SmartSuite View Definition
 */
export interface SmartSuiteView {
  id: string;
  name: string;
  type: 'grid' | 'kanban' | 'calendar' | 'timeline' | 'gallery' | 'form';
  default?: boolean;
  filter?: SmartSuiteFilter;
  sort?: SmartSuiteSort[];
  fields?: string[]; // Field IDs to display
}

/**
 * SmartSuite Filter Definition
 */
export interface SmartSuiteFilter {
  operator: 'and' | 'or';
  conditions: Array<{
    field: string;
    operator: FilterOperator;
    value: unknown;
  }>;
}

export type FilterOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'has_any_of'
  | 'has_all_of'
  | 'has_none_of';

/**
 * SmartSuite Sort Definition
 */
export interface SmartSuiteSort {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * SmartSuite Record
 */
export interface SmartSuiteRecord {
  id: string;
  [fieldId: string]: unknown; // Field values keyed by field ID
  created_at?: string;
  updated_at?: string;
  created_by?: SmartSuiteUser;
  updated_by?: SmartSuiteUser;
}

/**
 * SmartSuite User
 */
export interface SmartSuiteUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

/**
 * SmartSuite API List Response
 */
export interface SmartSuiteListResponse<T = SmartSuiteRecord> {
  items: T[];
  total_count: number;
  has_more: boolean;
  next_offset?: number;
}

/**
 * SmartSuite API Error Response
 */
export interface SmartSuiteErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  request_id?: string;
}

/**
 * SmartSuite Bulk Operation Response
 */
export interface SmartSuiteBulkResponse {
  success_count: number;
  error_count: number;
  errors?: Array<{
    index: number;
    record_id?: string;
    error: SmartSuiteErrorResponse['error'];
  }>;
  records?: SmartSuiteRecord[];
}

/**
 * SmartSuite Checklist Item (SmartDoc format)
 */
export interface SmartSuiteChecklistItem {
  type: 'checklist_item';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  attrs?: {
    checked: boolean;
  };
}

/**
 * SmartSuite SmartDoc Structure
 */
export interface SmartSuiteSmartDoc {
  type: 'doc';
  content: Array<{
    type: 'checklist';
    content: SmartSuiteChecklistItem[];
  }>;
}

/**
 * SmartSuite Linked Record Reference
 */
export interface SmartSuiteLinkedRecord {
  record_id: string;
  display_value?: string;
}

/**
 * Type guards for runtime validation
 */
export function isSmartSuiteRecord(value: unknown): value is SmartSuiteRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as SmartSuiteRecord).id === 'string'
  );
}

export function isSmartSuiteListResponse(value: unknown): value is SmartSuiteListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray((value as SmartSuiteListResponse).items) &&
    'total_count' in value &&
    typeof (value as SmartSuiteListResponse).total_count === 'number'
  );
}

export function isSmartSuiteErrorResponse(value: unknown): value is SmartSuiteErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as SmartSuiteErrorResponse).error === 'object'
  );
}

/**
 * SmartSuite Workspace Info
 */
export interface SmartSuiteWorkspace {
  id: string;
  name: string;
  subdomain?: string;
  plan?: string;
  created_at?: string;
  tables?: SmartSuiteTableSchema[];
}

/**
 * SmartSuite Authentication Response
 */
export interface SmartSuiteAuthResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in?: number;
  refresh_token?: string;
  workspace?: SmartSuiteWorkspace;
}

/**
 * SmartSuite Webhook Event
 */
export interface SmartSuiteWebhookEvent {
  id: string;
  type: 'record.created' | 'record.updated' | 'record.deleted';
  timestamp: string;
  workspace_id: string;
  table_id: string;
  record_id: string;
  changes?: Record<string, {
    old_value: unknown;
    new_value: unknown;
  }>;
  record?: SmartSuiteRecord;
}
