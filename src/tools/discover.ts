// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Technical-Architect: function module pattern for tool extraction

import { createToolArgumentGuard } from '../lib/type-guards.js';

import type { ToolContext } from './types.js';

// ============================================================================
// TYPE DEFINITIONS & GUARDS
// ============================================================================

export interface DiscoverToolArgs {
  scope: 'tables' | 'fields';
  tableId?: string;
  [key: string]: unknown;
}

export const isDiscoverToolArgs = createToolArgumentGuard<DiscoverToolArgs>(
  ['scope'],
  {
    scope: (v): v is DiscoverToolArgs['scope'] =>
      typeof v === 'string' && ['tables', 'fields'].includes(v),
    tableId: (v): v is string => v === undefined || typeof v === 'string',
  },
);

/**
 * Handle discovery of tables and fields
 * Enables exploration of available tables and their human-readable field names
 *
 * Note: Function signature is async to maintain interface contract with ToolHandler,
 * but current implementation is synchronous. Future enhancements may require async operations.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Interface contract requires async signature
export async function handleDiscover(
  context: ToolContext,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Type-safe argument validation with specific error handling
  if (!isDiscoverToolArgs(args)) {
    // Provide specific error for invalid scope
    if (typeof args.scope === 'string' && !['tables', 'fields'].includes(args.scope)) {
      throw new Error(`Invalid scope: ${args.scope}. Must be 'tables' or 'fields'`);
    }
    throw new Error('Invalid arguments for discover operation');
  }

  const { tableResolver, fieldTranslator } = context;
  const { scope, tableId } = args;

  if (scope === 'tables') {
    // Return all available tables
    const tables = tableResolver.getAvailableTables();
    return {
      tables,
      count: tables.length,
      message: `Found ${tables.length} available table${tables.length === 1 ? '' : 's'}. Use table names directly in queries.`,
    };
  } else if (scope === 'fields') {
    if (!tableId) {
      throw new Error('tableId is required when scope is "fields"');
    }

    // Resolve table name if needed
    const resolvedId = tableResolver.resolveTableId(tableId);
    if (!resolvedId) {
      const suggestions = tableResolver.getSuggestionsForUnknown(tableId);
      const availableTables = tableResolver.getAllTableNames();
      throw new Error(
        `Unknown table '${tableId}'. ` +
        (suggestions.length > 0
          ? `Did you mean: ${suggestions.join(', ')}?`
          : `Available tables: ${availableTables.join(', ')}`
        ),
      );
    }

    // Get table info
    const tableInfo = tableResolver.getTableByName(tableId) ??
                     tableResolver.getAvailableTables().find((t: { id: string; name: string }) => t.id === resolvedId);

    // Get field mappings if available - using type-safe approach with proper guards
    if (fieldTranslator.hasMappings(resolvedId)) {
      try {
        // Type guard for fieldTranslator.getMappings() method to handle potential unknown return type
        // Safely call getMappings using type assertion after runtime check
        const hasGetMappingsMethod = 'getMappings' in fieldTranslator &&
                                   typeof (fieldTranslator as { getMappings?: () => unknown }).getMappings === 'function';

        if (!hasGetMappingsMethod) {
          // Method doesn't exist, fall through to no mappings case
          return {
            table: tableInfo,
            fields: {},
            fieldCount: 0,
            message: `Table '${tableInfo?.name ?? tableId}' has no field mappings configured. Use raw API field codes or configure mappings.`,
          };
        }

        const getMappingsResult: unknown = (fieldTranslator as { getMappings: () => unknown }).getMappings();

        // Verify getMappings() returned a valid result before proceeding
        if (getMappingsResult === undefined || getMappingsResult === null) {
          // getMappings() returned null/undefined, fall through to no mappings case
          return {
            table: tableInfo,
            fields: {},
            fieldCount: 0,
            message: `Table '${tableInfo?.name ?? tableId}' has no field mappings configured. Use raw API field codes or configure mappings.`,
          };
        }

        const mappings = getMappingsResult;

        // Type guard for Map-like object with get method
        type HasGetAndFields = { get: (k: string) => unknown; fields?: unknown };
        function hasGetMethod(obj: unknown): obj is HasGetAndFields {
          return typeof obj === 'object' && obj !== null && 'get' in obj && typeof (obj as HasGetAndFields).get === 'function';
        }

        if (hasGetMethod(mappings)) {
          const mapping = mappings.get(resolvedId);

          // Type guard for mapping with fields property
          function hasFieldsProperty(obj: unknown): obj is { fields: Record<string, unknown> } {
            return typeof obj === 'object' && obj !== null && 'fields' in obj &&
                   typeof (obj as { fields: unknown }).fields === 'object' &&
                   (obj as { fields: unknown }).fields !== null;
          }

          if (hasFieldsProperty(mapping)) {
            const fields = mapping.fields;
            return {
              table: tableInfo,
              fields: fields,
              fieldCount: Object.keys(fields).length,
              message: `Table '${tableInfo?.name ?? tableId}' has ${Object.keys(fields).length} mapped fields. Use these human-readable names in your queries.`,
            };
          }
        }
      } catch {
        // If mapping access fails, fall through to no mappings case
      }
    }

    // No mappings available
    return {
      table: tableInfo,
      fields: {},
      fieldCount: 0,
      message: `Table '${tableInfo?.name ?? tableId}' has no field mappings configured. Use raw API field codes or configure mappings.`,
    };
  } else {
    throw new Error(`Invalid scope: ${scope}. Must be 'tables' or 'fields'`);
  }
}
