// Test-Methodology-Guardian: approved Strangler Fig Pattern implementation
// Implementation-Lead: Sentinel Architecture facade for tool consolidation
// Critical-Engineer: consulted for routing architecture and error handling
// Critical-Engineer: consulted for Git branching and commit strategy
// Context7: consulted for zod

import { z } from 'zod';

import logger from '../logger.js';

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

  // Natural language operation description (required)
  operation_description: z.string().min(1),

  // Optional fields for automatic endpoint/method generation
  endpoint: z.string().min(1).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),

  // Common operation fields
  tableId: z.string().optional(),
  appId: z.string().optional(), // Direct appId field for legacy support
  recordId: z.string().optional(), // Missing field that was causing TypeScript errors
  operation: z.string().optional(), // Missing field that was causing TypeScript errors
  payload: z.record(z.unknown()).optional(),
  mode: z.enum(['learn', 'dry_run', 'execute']).optional(),
  confirmed: z.boolean().optional(),

  // Legacy tool fields for direct parameter passing
  filters: z.record(z.unknown()).optional(),
  sort: z.record(z.unknown()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  data: z.record(z.unknown()).optional(),
  dry_run: z.boolean().optional(),
  output_mode: z.string().optional(),
  scope: z.string().optional(),
  transaction_id: z.string().optional(),

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

  // Extract common fields - handle both tableId and appId
  const { tableId, payload, mode } = args;

  // Type-safe extraction of optional fields
  const appId = 'appId' in args && typeof args.appId === 'string' ? args.appId : undefined;

  const dryRun = 'dry_run' in args && typeof args.dry_run === 'boolean' ? args.dry_run : undefined;

  const outputMode =
    'output_mode' in args && typeof args.output_mode === 'string' ? args.output_mode : undefined;

  const scope = 'scope' in args && typeof args.scope === 'string' ? args.scope : undefined;

  const directTableId =
    'tableId' in args && typeof args.tableId === 'string' ? args.tableId : undefined;

  switch (targetTool) {
    case 'smartsuite_query':
      return {
        operation: extractQueryOperation(args),
        appId: appId ?? tableId ?? extractAppIdFromEndpoint(args.endpoint),
        filters: payload?.filters ?? payload?.filter,
        sort: payload?.sort,
        limit: payload?.limit,
        offset: payload?.offset,
        recordId: payload?.recordId,
      };

    case 'smartsuite_record':
      return {
        operation: extractRecordOperation(args),
        appId: appId ?? tableId ?? extractAppIdFromEndpoint(args.endpoint),
        recordId: payload?.recordId ?? payload?.id,
        data: payload?.data ?? payload ?? {},
        dry_run: dryRun ?? mode !== 'execute', // Check explicit dry_run first
      };

    case 'smartsuite_schema':
      return {
        appId: appId ?? tableId ?? extractAppIdFromEndpoint(args.endpoint),
        output_mode: outputMode ?? payload?.output_mode ?? 'summary',
      };

    case 'smartsuite_undo':
      return {
        transaction_id: payload?.transaction_id ?? payload?.transactionId,
      };

    case 'smartsuite_discover':
      return {
        scope: scope ?? payload?.scope ?? detectDiscoverScope(args),
        tableId: directTableId ?? payload?.tableId ?? tableId ?? undefined,
      };

    case 'smartsuite_knowledge_field_mappings':
      return {
        tableId: tableId ?? extractAppIdFromEndpoint(args.endpoint),
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
 */
function extractQueryOperation(args: z.infer<typeof IntelligentFacadeSchema>): string {
  const desc = args.operation_description.toLowerCase();
  const endpoint = args.endpoint?.toLowerCase() ?? '';

  // Check for single record GET pattern in endpoint first
  if (endpoint.match(/\/records\/[a-f0-9]{24}\/?$/)) return 'get';

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
 */
function extractRecordOperation(args: z.infer<typeof IntelligentFacadeSchema>): string {
  const method = args.method?.toUpperCase() ?? 'POST';
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
 * Extract app ID from endpoint URL
 */
function extractAppIdFromEndpoint(endpoint: string | undefined): string {
  if (!endpoint) {
    return 'unknown-app-id';
  }
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

    // No routing detected - check if we need to generate endpoint/method for intelligent handler
    if (!validatedArgs.endpoint || !validatedArgs.method) {
      throw new Error(
        'No routing target detected and endpoint/method missing. Either use tool_name for explicit routing or provide endpoint/method for intelligent handler.',
      );
    }

    // Use original intelligent handler
    logger.info('Facade delegating to original intelligent handler:', {
      operation: validatedArgs.operation_description,
      endpoint: validatedArgs.endpoint,
      method: validatedArgs.method,
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
    throw error;
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
