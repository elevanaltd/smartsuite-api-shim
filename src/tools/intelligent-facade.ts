// Test-Methodology-Guardian: approved Strangler Fig Pattern implementation
// Implementation-Lead: Sentinel Architecture facade for tool consolidation
// Critical-Engineer: consulted for routing architecture and error handling
// Critical-Engineer: consulted for Test migration strategy and facade maintainability
// Context7: consulted for zod

import { z } from 'zod';

import logger from '../logger.js';
import { SmartDocValidationError } from '../validation/smartdoc-validator.js';

import { handleDiscover } from './discover.js';
import { handleIntelligent } from './intelligent.js';
import {
  handleKnowledgeEvents,
  handleKnowledgeFieldMappings,
  handleKnowledgeRefreshViews,
  type KnowledgeEventsArgs,
  type KnowledgeFieldMappingsArgs,
  type KnowledgeRefreshViewsArgs,
} from './knowledge.js';
import { handleQuery } from './query.js';
import { handleRecord } from './record.js';
import { handleSchema } from './schema.js';
import type { Tool } from './tool-registry.js';
import type { ToolContext } from './types.js';
import { handleUndo } from './undo.js';

// Enhanced intelligent tool schema that supports routing
const IntelligentFacadeSchema = z.object({
  // CRITICAL FIX: Deterministic routing field (code-review-specialist recommendation)
  tool_name: z
    .enum([
      'smartsuite_query',
      'smartsuite_record',
      'smartsuite_schema',
      'smartsuite_undo',
      'smartsuite_discover',
      'smartsuite_intelligent',
      'smartsuite_knowledge_events',
      'smartsuite_knowledge_field_mappings',
      'smartsuite_knowledge_refresh_views',
    ])
    .optional()
    .describe('Explicit tool routing - use this for deterministic behavior'),

  // Original intelligent tool fields
  endpoint: z.string().min(1).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(), // B3 Integration: Allow method inference
  operation_description: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  tableId: z.string().optional(),
  appId: z.string().optional(), // Backward compatibility with legacy tests
  mode: z.enum(['learn', 'dry_run', 'execute']).optional(),
  confirmed: z.boolean().optional(),

  // Additional fields for routing compatibility
  recordId: z.string().optional(), // For direct record operations
  operation: z.string().optional(), // Explicit operation type

  // Routing extension for legacy tool support (deprecated in favor of tool_name)
  _route_to_legacy: z.string().optional(), // Internal routing hint
  _legacy_args: z.record(z.unknown()).optional(), // Legacy tool arguments
});

// Operation mapping for automatic routing detection
const OPERATION_ROUTING_MAP = {
  'list records': 'smartsuite_query',
  'get record': 'smartsuite_query',
  'search records': 'smartsuite_query',
  'count records': 'smartsuite_query',
  'create record': 'smartsuite_record',
  'update record': 'smartsuite_record',
  'delete record': 'smartsuite_record',
  'bulk update': 'smartsuite_record',
  'bulk delete': 'smartsuite_record',
  'get schema': 'smartsuite_schema',
  'get field definitions': 'smartsuite_schema',
  'undo operation': 'smartsuite_undo',
  'rollback transaction': 'smartsuite_undo',
  'discover tables': 'smartsuite_discover',
  'discover fields': 'smartsuite_discover',
  'get field mappings': 'smartsuite_knowledge_field_mappings',
  'append event': 'smartsuite_knowledge_events',
  'get events': 'smartsuite_knowledge_events',
  'refresh views': 'smartsuite_knowledge_refresh_views',
} as const;

// B3 Integration: Protective Intelligence Knowledge Base
const LINKED_RECORD_FIELDS = [
  'projects_link',
  'assigned_to',
  'batch_alloc',
  'parent_task',
  'linked_records',
  'project',
  'user',
  'team_members',
  'dependencies',
  'subtasks',
];

const CHECKLIST_FIELD_PATTERNS = ['checklist', 'tasks', 'items', 'todo', 'requirements'];

/**
 * Check if a field name indicates a linked record field
 */
function isLinkedRecordField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase();
  return LINKED_RECORD_FIELDS.some(
    (pattern) =>
      normalized.includes(pattern) || normalized.endsWith('_link') || normalized.endsWith('_id'),
  );
}

/**
 * Check if a field name indicates a checklist field
 */
function isChecklistField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase();
  return CHECKLIST_FIELD_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Analyze operation description and determine routing target
 */
function detectLegacyToolRouting(operationDescription: string): string | null {
  const normalized = operationDescription.toLowerCase().trim();

  // Direct mapping check
  for (const [pattern, toolName] of Object.entries(OPERATION_ROUTING_MAP)) {
    if (normalized.includes(pattern)) {
      return toolName;
    }
  }

  // Keyword-based routing (more specific patterns first)
  if (
    normalized.includes('get') &&
    (normalized.includes('record') ||
      normalized.includes('by id') ||
      normalized.includes('specific'))
  ) {
    return 'smartsuite_query';
  }

  if (
    normalized.includes('query') ||
    normalized.includes('search') ||
    normalized.includes('list') ||
    normalized.includes('filter')
  ) {
    return 'smartsuite_query';
  }

  if (
    normalized.includes('create') ||
    normalized.includes('update') ||
    normalized.includes('delete') ||
    normalized.includes('modify')
  ) {
    return 'smartsuite_record';
  }

  if (
    normalized.includes('schema') ||
    normalized.includes('structure') ||
    normalized.includes('fields')
  ) {
    return 'smartsuite_schema';
  }

  if (
    normalized.includes('undo') ||
    normalized.includes('rollback') ||
    normalized.includes('revert')
  ) {
    return 'smartsuite_undo';
  }

  if (
    normalized.includes('discover') ||
    normalized.includes('tables') ||
    normalized.includes('available')
  ) {
    return 'smartsuite_discover';
  }

  return null; // Route to original intelligent handler
}

/**
 * Apply protective intelligence to data fields
 * B3 Integration: Auto-wrap linked records, validate SmartDoc formats
 */
function applyProtectiveIntelligence(data: Record<string, unknown>): Record<string, unknown> {
  const protectedData = { ...data };

  for (const [fieldName, value] of Object.entries(protectedData)) {
    // Array Wrapping Protection: Wrap single linked record values
    if (isLinkedRecordField(fieldName) && value != null && !Array.isArray(value)) {
      logger.info(
        `Protective Intelligence: Wrapping single linked record value for field ${fieldName}`,
      );
      protectedData[fieldName] = [value];
    }

    // SmartDoc Validation: Detect dangerous formats that cause silent data loss
    if (
      isChecklistField(fieldName) &&
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === 'string'
    ) {
      throw new SmartDocValidationError(
        `Invalid checklist format for field ${fieldName}: Simple arrays ["item1", "item2"] cause silent data loss in SmartSuite API. Use proper SmartDoc rich text structure.`,
        'checklist',
        value,
      );
    }
  }

  return protectedData;
}

/**
 * Apply protective intelligence to filter operators
 * B3 Integration: Auto-correct "is" to "has_any_of" for linked records
 */
function applyFilterProtection(filters: unknown): unknown {
  // Type guard for filter structure
  if (!filters || typeof filters !== 'object' || !('fields' in filters)) {
    return filters;
  }

  const filterObj = filters as { fields?: unknown[]; [key: string]: unknown };
  if (!filterObj.fields || !Array.isArray(filterObj.fields)) {
    return filters;
  }

  const protectedFilters = { ...filterObj };
  protectedFilters.fields = filterObj.fields.map((field) => {
    // Type guard for field structure
    if (!field || typeof field !== 'object') {
      return field;
    }

    const fieldObj = field as { field?: string; comparison?: string; [key: string]: unknown };
    if (fieldObj.field && isLinkedRecordField(fieldObj.field) && fieldObj.comparison === 'is') {
      logger.info(
        `Protective Intelligence: Correcting filter operator for linked field ${fieldObj.field}: is → has_any_of`,
      );
      return { ...fieldObj, comparison: 'has_any_of' };
    }
    return field;
  });

  return protectedFilters;
}

/**
 * Infer HTTP method from operation context
 * B3 Integration: Smart method inference when not explicitly provided
 */
function inferHttpMethod(args: z.infer<typeof IntelligentFacadeSchema>): string {
  // If method is explicitly provided, use it
  if (args.method) {
    return args.method;
  }

  const desc = args.operation_description.toLowerCase();
  const hasRecordId = args.recordId ?? args.payload?.recordId ?? args.payload?.id;

  // Method inference based on operation and context
  if (desc.includes('delete') || desc.includes('remove')) return 'DELETE';
  if (desc.includes('update') || desc.includes('edit') || desc.includes('modify')) return 'PATCH';
  if (desc.includes('create') || desc.includes('add') || desc.includes('new')) return 'POST';
  if (hasRecordId && (desc.includes('get') || desc.includes('fetch'))) return 'GET';

  // Smart default: PATCH for updates (when recordId present), POST for creates
  return hasRecordId ? 'PATCH' : 'POST';
}

/**
 * Add trailing slash to endpoint if missing
 * B3 Integration: Ensure all endpoints have trailing slashes
 */
function ensureTrailingSlash(endpoint: string): string {
  return endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
}

/**
 * Convert intelligent tool arguments to legacy tool format
 */
function convertToLegacyArgs(
  targetTool: string,
  args: z.infer<typeof IntelligentFacadeSchema>,
): Record<string, unknown> {
  // If legacy args are provided explicitly, use them
  if (args._legacy_args) {
    return args._legacy_args;
  }

  // Extract common fields - prioritize appId for legacy compatibility
  const { tableId, appId, payload, mode } = args;
  const effectiveTableId = appId ?? tableId;

  // B3 Integration: Generate endpoint if not provided and ensure trailing slash
  const effectiveEndpoint = ensureTrailingSlash(args.endpoint ?? generateDefaultEndpoint(args));

  // B3 Integration: Apply protective intelligence to payload data
  const protectedPayload = payload ? applyProtectiveIntelligence(payload) : payload;

  switch (targetTool) {
    case 'smartsuite_query':
      return {
        operation: extractQueryOperation(args),
        appId: effectiveTableId ?? extractAppIdFromEndpoint(effectiveEndpoint),
        filters: applyFilterProtection(protectedPayload?.filters ?? protectedPayload?.filter),
        sort: protectedPayload?.sort,
        limit: protectedPayload?.limit,
        offset: protectedPayload?.offset,
        recordId: protectedPayload?.recordId,
      };

    case 'smartsuite_record':
      return {
        operation: extractRecordOperation(args),
        appId: effectiveTableId ?? extractAppIdFromEndpoint(effectiveEndpoint),
        recordId: protectedPayload?.recordId ?? protectedPayload?.id,
        data: protectedPayload ?? {},
        dry_run: mode !== 'execute', // Default to dry_run unless execute mode
      };

    case 'smartsuite_schema':
      return {
        appId: effectiveTableId ?? extractAppIdFromEndpoint(effectiveEndpoint),
        output_mode: payload?.output_mode ?? 'summary',
      };

    case 'smartsuite_undo':
      return {
        transaction_id: payload?.transaction_id ?? payload?.transactionId,
      };

    case 'smartsuite_discover':
      return {
        scope: payload?.scope ?? detectDiscoverScope(args),
        tableId: payload?.tableId ?? effectiveTableId ?? undefined,
      };

    case 'smartsuite_knowledge_field_mappings':
      return {
        tableId:
          effectiveTableId ??
          (effectiveEndpoint ? extractAppIdFromEndpoint(effectiveEndpoint) : 'unknown'),
      };

    case 'smartsuite_knowledge_events':
      return {
        operation: payload?.operation ?? detectKnowledgeEventOperation(args),
        aggregateId: payload?.aggregateId,
        event: payload?.event,
        limit: payload?.limit,
      };

    case 'smartsuite_knowledge_refresh_views':
      return {
        views: payload?.views,
      };

    default:
      return payload ?? {};
  }
}

/**
 * Extract query operation from intelligent args
 * Technical-Architect: Added single record GET detection via endpoint pattern
 * B3 Integration: Handle optional endpoint gracefully
 */
function extractQueryOperation(args: z.infer<typeof IntelligentFacadeSchema>): string {
  const desc = args.operation_description.toLowerCase();

  // Check for single record GET pattern in endpoint first (if endpoint exists)
  if (args.endpoint) {
    const endpoint = args.endpoint.toLowerCase();
    if (endpoint.match(/\/records\/[a-f0-9]{24}\/?$/)) return 'get';
  }

  // Check for recordId in various places
  if (args.recordId || args.payload?.recordId || args.payload?.id) return 'get';

  // Description-based detection
  if (desc.includes('count')) return 'count';
  if (desc.includes('search')) return 'search';
  if (desc.includes('get') && (args.payload?.recordId || args.recordId)) return 'get';

  return 'list';
}

/**
 * Extract record operation from intelligent args
 * Technical-Architect: Fixed operation detection logic to properly handle UPDATE/DELETE
 * B3 Integration: Use inferred method when not explicitly provided
 */
function extractRecordOperation(args: z.infer<typeof IntelligentFacadeSchema>): string {
  const method = (args.method ?? inferHttpMethod(args)).toUpperCase();
  const desc = args.operation_description.toLowerCase();

  // Check explicit operation field first (if provided)
  if (args.operation) {
    return args.operation;
  }

  // Method-based detection (priority) - DELETE must be checked first
  if (method === 'DELETE') return 'delete';
  if (method === 'PATCH' || method === 'PUT') return 'update';
  if (method === 'POST' && (args.recordId || args.payload?.recordId || args.payload?.id)) {
    return 'update'; // POST with ID = update
  }
  if (method === 'POST') return 'create';

  // Description-based fallback
  if (desc.includes('delete') || desc.includes('remove')) return 'delete';
  if (desc.includes('update') || desc.includes('edit') || desc.includes('modify')) return 'update';
  if (desc.includes('create') || desc.includes('add') || desc.includes('new')) return 'create';

  // Bulk operations
  if (desc.includes('bulk')) {
    if (desc.includes('delete')) return 'bulk_delete';
    if (desc.includes('update')) return 'bulk_update';
    return 'bulk_update'; // Default bulk to update
  }

  // Smart default based on presence of recordId
  if (args.payload?.recordId || args.payload?.id || args.recordId) {
    return 'update'; // If record ID present, likely update
  }

  return 'create'; // Final fallback
}

/**
 * Generate default endpoint from tableId and operation description
 * B3 Integration: Handle missing endpoint by creating appropriate defaults
 */
function generateDefaultEndpoint(args: z.infer<typeof IntelligentFacadeSchema>): string {
  const appId = args.appId ?? args.tableId ?? 'unknown-app-id';
  const desc = args.operation_description.toLowerCase();

  // Generate appropriate endpoint based on operation
  if (desc.includes('record') && (args.payload?.recordId || args.recordId)) {
    // Single record operations
    const recordIdValue = args.payload?.recordId ?? args.recordId ?? 'record-id';
    // Ensure we have a string recordId, handling various input types
    let recordId: string;
    if (typeof recordIdValue === 'string') {
      recordId = recordIdValue;
    } else if (typeof recordIdValue === 'number') {
      recordId = recordIdValue.toString();
    } else {
      recordId = 'record-id';
    }
    return `/applications/${appId}/records/${recordId}/`;
  } else if (desc.includes('schema') || desc.includes('field')) {
    // Schema operations
    return `/applications/${appId}/`;
  } else {
    // Default to records collection endpoint
    return `/applications/${appId}/records/`;
  }
}

/**
 * Extract app ID from endpoint URL
 */
function extractAppIdFromEndpoint(endpoint: string): string {
  // Match patterns like /applications/{id}/ or /apps/{id}/
  const match = endpoint.match(/\/(?:applications|apps)\/([a-f0-9]{24})/i);
  return match?.[1] ?? 'unknown-app-id';
}

/**
 * Detect discover scope from operation description
 */
function detectDiscoverScope(args: z.infer<typeof IntelligentFacadeSchema>): 'fields' | 'tables' {
  const desc = args.operation_description.toLowerCase();
  return desc.includes('fields') ? 'fields' : 'tables';
}

/**
 * Detect knowledge event operation type
 */
function detectKnowledgeEventOperation(
  args: z.infer<typeof IntelligentFacadeSchema>,
): 'append' | 'get' {
  const desc = args.operation_description.toLowerCase();
  return desc.includes('append') || desc.includes('create') ? 'append' : 'get';
}

/**
 * Intelligent Facade Handler - Routes to legacy tools or intelligent handler
 */
export async function handleIntelligentFacade(
  context: ToolContext,
  args: Record<string, unknown>,
): Promise<unknown> {
  const validatedArgs = IntelligentFacadeSchema.parse(args);

  // CRITICAL FIX: Deterministic routing via tool_name field (code-review-specialist)
  let targetTool: string | undefined;

  if (validatedArgs.tool_name) {
    // Priority 1: Use explicit tool_name for deterministic routing
    targetTool = validatedArgs.tool_name;
    logger.info('Using deterministic routing via tool_name', {
      tool_name: targetTool,
      operation: validatedArgs.operation_description,
    });
  } else if (validatedArgs._route_to_legacy) {
    // Priority 2: Check for legacy routing hint (deprecated)
    targetTool = validatedArgs._route_to_legacy;
    logger.warn('Using deprecated _route_to_legacy routing', {
      target: targetTool,
      operation: validatedArgs.operation_description,
    });
  } else {
    // Priority 3: Fallback to detection with warning
    targetTool = detectLegacyToolRouting(validatedArgs.operation_description) ?? undefined;
    if (targetTool) {
      logger.warn(
        'Using fallback routing detection - consider using tool_name for deterministic behavior',
        {
          detected_tool: targetTool,
          operation: validatedArgs.operation_description,
        },
      );
    }
  }

  const startTime = Date.now();

  // Track legacy args for error logging
  let legacyArgs: Record<string, unknown> | undefined;

  try {
    // Route to legacy tool handlers
    if (targetTool) {
      legacyArgs = convertToLegacyArgs(targetTool, validatedArgs);

      logger.info(`Facade routing to ${targetTool}:`, {
        original_operation: validatedArgs.operation_description,
        target_tool: targetTool,
        routing_time_ms: Date.now() - startTime,
        legacy_args: legacyArgs, // HIGH FIX: Include args for debugging
      });

      // Dispatch to appropriate handler
      switch (targetTool) {
        case 'smartsuite_query':
          return await handleQuery(context, legacyArgs);

        case 'smartsuite_record':
          return await handleRecord(context, legacyArgs);

        case 'smartsuite_schema':
          return await handleSchema(context, legacyArgs);

        case 'smartsuite_undo':
          return await handleUndo(context, legacyArgs);

        case 'smartsuite_discover':
          return await handleDiscover(context, legacyArgs);

        case 'smartsuite_knowledge_field_mappings':
          return await handleKnowledgeFieldMappings(
            legacyArgs as unknown as KnowledgeFieldMappingsArgs,
            context,
          );

        case 'smartsuite_knowledge_events':
          return await handleKnowledgeEvents(legacyArgs as unknown as KnowledgeEventsArgs, context);

        case 'smartsuite_knowledge_refresh_views':
          return await handleKnowledgeRefreshViews(
            legacyArgs as KnowledgeRefreshViewsArgs,
            context,
          );

        default:
          throw new Error(`Unknown routing target: ${targetTool}`);
      }
    }

    // No routing detected - use original intelligent handler
    logger.info('Facade delegating to original intelligent handler:', {
      operation: validatedArgs.operation_description,
      no_routing_detected: true,
    });

    return await handleIntelligent(context, args);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Facade routing failed:', {
      target_tool: targetTool,
      operation: validatedArgs.operation_description,
      duration_ms: duration,
      error: error instanceof Error ? error.message : String(error),
      legacy_args: legacyArgs, // HIGH FIX: Include generated args for debugging (code-review-specialist)
      original_args: args, // Include original args for complete context
    });
    // Critical-Engineer: Enhanced error messages for test debugging
    // Preserve expected error messages for known patterns
    if (error instanceof Error) {
      const errorMessage = error.message;
      // These are expected errors that tests rely on - don't wrap them
      if (
        errorMessage.includes('Unknown query operation') ||
        errorMessage.includes('Unknown table') ||
        errorMessage.includes('requires recordId') ||
        errorMessage.includes('API key is required') ||
        errorMessage.includes('SmartDoc validation failed')
      ) {
        throw error; // Preserve original error for test contracts
      }
    }

    // For unexpected errors, provide context
    const contextualError = new Error(
      `Facade dispatch to '${targetTool ?? 'unknown-tool'}' failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Preserve original stack trace
    if (error instanceof Error && error.stack) {
      contextualError.stack = error.stack;
    }
    throw contextualError;
  }
}

// Export the facade tool definition
export const IntelligentFacadeTool: Tool<typeof IntelligentFacadeSchema> = {
  name: 'smartsuite_intelligent',
  description:
    'AI-guided access to any SmartSuite API with knowledge-driven safety and automatic tool routing',
  schema: IntelligentFacadeSchema,
  execute: async (context: ToolContext, args) => {
    return handleIntelligentFacade(context, args as Record<string, unknown>);
  },
};
