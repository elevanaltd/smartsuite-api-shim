// Critical-Engineer: consulted for MCP tool handler refactoring
// Technical-Architect: synthesized third-way solution using function modules
// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle

import type { SmartSuiteClient } from '../smartsuite-client';
import type { FieldTranslator } from '../lib/field-translator';
import type { TableResolver } from '../lib/table-resolver';
import type { AuditLogger } from '../lib/audit-logger';

/**
 * Minimal context object passed to tool functions
 * Each tool receives exactly what it needs, no God Object pattern
 */
export interface ToolContext {
  client: SmartSuiteClient;
  fieldTranslator: FieldTranslator;
  tableResolver: TableResolver;
  auditLogger: AuditLogger;
}
