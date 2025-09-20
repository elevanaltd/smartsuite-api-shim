// Test helper to register all tools for backward compatibility in tests
// This allows tests to continue using direct tool names while production uses Sentinel Architecture

import logger from '../../src/logger.js';
import {
  QueryTool,
  RecordTool,
  SchemaTool,
  UndoTool,
  DiscoverTool,
  IntelligentTool,
  KnowledgeEventsTool,
  KnowledgeFieldMappingsTool,
  KnowledgeRefreshViewsTool,
  IntelligentFacadeTool,
} from '../../src/tools/tool-definitions.js';
import { defaultToolRegistry } from '../../src/tools/tool-registry.js';

/**
 * Register all 9 tools for test environments
 * This is the pre-Sentinel behavior needed for backward compatibility
 */
export function registerAllToolsForTesting(): void {
  // Clear registry first
  defaultToolRegistry.clear();

  logger.info('Test mode: Registering all 9 tools for backward compatibility');

  const allTools = [
    { name: 'QueryTool', tool: QueryTool },
    { name: 'RecordTool', tool: RecordTool },
    { name: 'SchemaTool', tool: SchemaTool },
    { name: 'UndoTool', tool: UndoTool },
    { name: 'DiscoverTool', tool: DiscoverTool },
    { name: 'IntelligentTool', tool: IntelligentTool },
    { name: 'KnowledgeEventsTool', tool: KnowledgeEventsTool },
    { name: 'KnowledgeFieldMappingsTool', tool: KnowledgeFieldMappingsTool },
    { name: 'KnowledgeRefreshViewsTool', tool: KnowledgeRefreshViewsTool },
  ];

  for (const { name, tool } of allTools) {
    try {
      // Use type assertion to bypass strict TypeScript checking
      defaultToolRegistry.register(tool as any);
      logger.debug(`Registered ${name} for testing`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to register ${name}:`, errorMessage);
      throw new Error(`Test setup failed: Could not register ${name}`);
    }
  }

  logger.info(`Test setup complete: ${allTools.length} tools registered`);
}

/**
 * Register only the Sentinel Architecture tools (facade + undo)
 * This is for testing the production behavior
 */
export function registerSentinelToolsForTesting(): void {
  // Clear registry first
  defaultToolRegistry.clear();

  logger.info('Test mode: Registering Sentinel Architecture (2 tools)');

  try {
    defaultToolRegistry.register(IntelligentFacadeTool);
    defaultToolRegistry.register(UndoTool);
    logger.info('Sentinel Architecture test setup complete: 2 tools registered');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to register Sentinel tools:', errorMessage);
    throw new Error('Test setup failed: Could not register Sentinel tools');
  }
}

/**
 * Get the appropriate tool registration based on test requirements
 * @param useSentinel - If true, registers only 2 Sentinel tools, otherwise all 9
 */
export function setupTestToolRegistry(useSentinel = false): void {
  if (useSentinel) {
    registerSentinelToolsForTesting();
  } else {
    registerAllToolsForTesting();
  }
}
