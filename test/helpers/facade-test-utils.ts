// Critical-Engineer: consulted for Test infrastructure migration and facade pattern validation
// Critical-Engineer: Test helper to eliminate migration errors and ensure consistency
// Facade migration utility for converting 3-tool pattern to 2-tool pattern

import type { SmartSuiteShimServer } from '../../src/mcp-server.js';

/**
 * Execute a SmartSuite tool through the intelligent facade
 * This helper abstracts the migration pattern to eliminate copy-paste errors
 * and ensure consistency across all test files.
 */
export function executeSmartSuiteTool(
  server: SmartSuiteShimServer,
  toolName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  return server.executeTool('smartsuite_intelligent', {
    tool_name: toolName,
    operation_description: `Executing ${toolName} for test`,
    ...params,
  });
}

/**
 * Typed helpers for specific tools to improve developer experience
 */
export const SmartSuiteTestTools = {
  query: (server: SmartSuiteShimServer, params: Record<string, unknown>) =>
    executeSmartSuiteTool(server, 'smartsuite_query', params),

  record: (server: SmartSuiteShimServer, params: Record<string, unknown>) =>
    executeSmartSuiteTool(server, 'smartsuite_record', params),

  schema: (server: SmartSuiteShimServer, params: Record<string, unknown>) =>
    executeSmartSuiteTool(server, 'smartsuite_schema', params),

  discover: (server: SmartSuiteShimServer, params: Record<string, unknown>) =>
    executeSmartSuiteTool(server, 'smartsuite_discover', params),

  undo: (server: SmartSuiteShimServer, params: Record<string, unknown>) =>
    executeSmartSuiteTool(server, 'smartsuite_undo', params),
};
