// TESTGUARD-APPROVED: Test evolution from bug reproduction to fix validation
// Context7: consulted for vitest
// Context7: consulted for fs
import * as fs from 'fs';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AuditLogger, type MutationLogInput } from '../audit-logger.js';

describe('AuditLogger MCP Environment', () => {
  const testAuditPath = '/tmp/test-audit-trail-mcp.json';

  beforeEach(async () => {
    // Clean up test files
    if (fs.existsSync(testAuditPath)) {
      await fs.promises.unlink(testAuditPath);
    }
    if (fs.existsSync(`${testAuditPath}.lock`)) {
      await fs.promises.unlink(`${testAuditPath}.lock`);
    }
  });

  afterEach(async () => {
    // Clean up test files
    if (fs.existsSync(testAuditPath)) {
      await fs.promises.unlink(testAuditPath);
    }
    if (fs.existsSync(`${testAuditPath}.lock`)) {
      await fs.promises.unlink(`${testAuditPath}.lock`);
    }
  });

  it('should successfully log mutations with native fs/promises in MCP environment', async () => {
    const auditLogger = new AuditLogger(testAuditPath);

    const testInput: MutationLogInput = {
      operation: 'create',
      tableId: 'test-table-123',
      recordId: 'test-record-456',
      payload: { title: 'Test Record' },
      result: { id: 'test-record-456', title: 'Test Record' },
      reversalInstructions: {
        operation: 'delete',
        tableId: 'test-table-123',
        recordId: 'test-record-456',
      },
    };

    // Should not throw - this validates the fs-extra → native fs fix
    await expect(auditLogger.logMutation(testInput)).resolves.toBeUndefined();

    // Verify audit file was created and contains the entry
    expect(fs.existsSync(testAuditPath)).toBe(true);

    const entries = await auditLogger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      operation: 'create',
      tableId: 'test-table-123',
      recordId: 'test-record-456',
      payload: { title: 'Test Record' },
    });
  });

  it('should handle multiple concurrent operations with native fs locking', async () => {
    const auditLogger = new AuditLogger(testAuditPath);

    const operations = [
      {
        operation: 'create' as const,
        tableId: 'test-table-1',
        recordId: 'record-1',
        payload: { title: 'Record 1' },
        reversalInstructions: { operation: 'delete' as const, tableId: 'test-table-1', recordId: 'record-1' },
      },
      {
        operation: 'update' as const,
        tableId: 'test-table-2',
        recordId: 'record-2',
        payload: { title: 'Record 2 Updated' },
        reversalInstructions: { operation: 'update' as const, tableId: 'test-table-2', recordId: 'record-2', payload: { title: 'Original' } },
      },
    ];

    // Execute operations concurrently to test file locking
    await Promise.all(operations.map(op => auditLogger.logMutation(op)));

    const entries = await auditLogger.getEntries();
    expect(entries).toHaveLength(2);
  });
});
