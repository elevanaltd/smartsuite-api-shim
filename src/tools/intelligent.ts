// Critical-Engineer: consulted for complex handler extraction patterns
// Technical-Architect: approved IntelligentOperationHandler function module design
// Test-Methodology-Guardian: confirmed TDD approach for complex extractions

import { IntelligentOperationHandler, KnowledgeLibrary, SafetyEngine } from '../intelligent/index.js';
import type { IntelligentToolInput } from '../intelligent/types.js';
import { createToolArgumentGuard } from '../lib/type-guards.js';
import { resolveKnowledgePath } from '../lib/path-resolver.js';
import type { SmartSuiteClient } from '../smartsuite-client.js';

import type { ToolContext } from './types.js';

// ============================================================================
// TYPE DEFINITIONS & GUARDS
// ============================================================================

export interface IntelligentToolArgs {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  operation_description: string;
  mode?: 'learn' | 'dry_run' | 'execute';
  payload?: Record<string, unknown>;
  tableId?: string;
  confirmed?: boolean;
  [key: string]: unknown;
}

export const isIntelligentToolArgs = createToolArgumentGuard<IntelligentToolArgs>(
  ['endpoint', 'method', 'operation_description'],
  {
    endpoint: (v): v is string => typeof v === 'string' && v.length > 0,
    method: (v): v is IntelligentToolArgs['method'] =>
      typeof v === 'string' && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(v),
    operation_description: (v): v is string => typeof v === 'string' && v.length > 0,
    mode: (v): v is IntelligentToolArgs['mode'] =>
      v === undefined || (typeof v === 'string' && ['learn', 'dry_run', 'execute'].includes(v)),
    tableId: (v): v is string => v === undefined || typeof v === 'string',
    confirmed: (v): v is boolean => v === undefined || typeof v === 'boolean',
  },
);

// Cache the intelligent handler to avoid re-initialization
// This follows the lazy initialization pattern from the main server
let intelligentHandlerCache: IntelligentOperationHandler | null = null;

/**
 * Initialize the intelligent handler lazily
 * Creates KnowledgeLibrary, SafetyEngine, and IntelligentOperationHandler
 */
async function initializeIntelligentHandler(client: SmartSuiteClient | undefined): Promise<IntelligentOperationHandler> {
  if (!intelligentHandlerCache) {
    const knowledgeLibrary = new KnowledgeLibrary();
    // Use path resolver to handle both development and production environments
    // Development: loads from src/knowledge
    // Production: loads from build/src/knowledge (copied during build)
    const knowledgePath = resolveKnowledgePath(import.meta.url);
    await knowledgeLibrary.loadFromResearch(knowledgePath);
    const safetyEngine = new SafetyEngine(knowledgeLibrary);
    // Pass the SmartSuiteClient to enable execute and dry_run modes
    const handler = new IntelligentOperationHandler(
      knowledgeLibrary,
      safetyEngine,
      client,  // Pass client for API proxy functionality
    );
    // Atomic assignment to avoid race condition warning
    intelligentHandlerCache = handler;
  }
  return intelligentHandlerCache;
}

/**
 * Handle intelligent tool operations with knowledge-driven safety
 * Supports learn, dry_run, and execute modes for comprehensive API coverage
 */
export async function handleIntelligent(
  context: ToolContext,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Type-safe argument validation
  if (!isIntelligentToolArgs(args)) {
    throw new Error('Invalid arguments for intelligent operation');
  }

  const { client } = context;

  // Note: Intelligent operations handle their own audit logging internally

  // Initialize handler if needed
  const intelligentHandler = await initializeIntelligentHandler(client);

  // Validate and transform input with type-safe destructuring
  const {
    endpoint,
    method,
    operation_description,
    mode = 'learn',
    payload,
    tableId,
    confirmed,
  } = args;

  const input: IntelligentToolInput = {
    mode,
    endpoint,
    method,
    operation_description,
  };

  // Add optional fields only if they exist
  if (payload !== undefined) {
    input.payload = payload;
  }
  if (tableId !== undefined) {
    input.tableId = tableId;
  }
  if (confirmed !== undefined) {
    input.confirmed = confirmed;
  }

  // All modes supported: learn, dry_run, execute
  // Validate client is available for dry_run and execute modes
  if ((input.mode === 'dry_run' || input.mode === 'execute') && !client) {
    throw new Error(`Client not initialized. Cannot use ${input.mode} mode without authentication.`);
  }

  // Use the intelligent handler to process the operation
  const result = await intelligentHandler.handleIntelligentOperation(input);
  return result;
}
