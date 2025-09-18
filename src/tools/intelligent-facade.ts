// Test-Methodology-Guardian: approved Strangler Fig Pattern implementation
// Implementation-Lead: Sentinel Architecture facade for tool consolidation
// Critical-Engineer: consulted for routing architecture and error handling
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

  // Original intelligent tool fields
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  operation_description: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  tableId: z.string().optional(),
  mode: z.enum(['learn', 'dry_run', 'execute']).optional(),
  confirmed: z.boolean().optional(),

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

  // Extract common fields
  const { tableId, payload, mode } = args;

  switch (targetTool) {
    case 'smartsuite_query':
      return {
        operation: extractQueryOperation(args),
        appId: tableId ?? extractAppIdFromEndpoint(args.endpoint),
        filters: payload?.filters ?? payload?.filter,
        sort: payload?.sort,
        limit: payload?.limit,
        offset: payload?.offset,
        recordId: payload?.recordId,
      };

    case 'smartsuite_record':
      return {
        operation: extractRecordOperation(args),
        appId: tableId ?? extractAppIdFromEndpoint(args.endpoint),
        recordId: payload?.recordId ?? payload?.id,
        data: payload ?? {},
        dry_run: mode !== 'execute', // Default to dry_run unless execute mode
      };

    case 'smartsuite_schema':
      return {
        appId: tableId ?? extractAppIdFromEndpoint(args.endpoint),
        output_mode: payload?.output_mode ?? 'summary',
      };

    case 'smartsuite_undo':
      return {
        transaction_id: payload?.transaction_id ?? payload?.transactionId,
      };

    case 'smartsuite_discover':
      return {
        scope: payload?.scope ?? detectDiscoverScope(args),
        tableId: payload?.tableId ?? tableId ?? undefined,
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
 */
function extractQueryOperation(args: z.infer<typeof IntelligentFacadeSchema>): string {
  const desc = args.operation_description.toLowerCase();

  if (desc.includes('count')) return 'count';
  if (desc.includes('search')) return 'search';
  if (desc.includes('get') && args.payload?.recordId) return 'get';
  return 'list';
}

/**
 * Extract record operation from intelligent args
 */
function extractRecordOperation(args: z.infer<typeof IntelligentFacadeSchema>): string {
  const method = args.method.toUpperCase();
  const desc = args.operation_description.toLowerCase();

  if (method === 'POST' || desc.includes('create')) return 'create';
  if (method === 'PUT' || method === 'PATCH' || desc.includes('update')) return 'update';
  if (method === 'DELETE' || desc.includes('delete')) return 'delete';
  if (desc.includes('bulk')) {
    return desc.includes('delete') ? 'bulk_delete' : 'bulk_update';
  }

  return 'create'; // Default fallback
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
