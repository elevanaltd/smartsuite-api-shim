// TRACED: Integration tests for audit trail functionality
// Context7: consulted for vitest
// Context7: consulted for fs-extra
// Context7: consulted for path
// TESTGUARD-APPROVED: Method name correction from handleTool to executeTool
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SmartSuiteShimServer } from '../src/mcp-server.js';
import { AuditLogger } from '../src/audit/audit-logger.js';

describe('Audit Integration', () => {
  let server: SmartSuiteShimServer;
  let testAuditFile: string;
  let auditLogger: AuditLogger;

  beforeEach(async () => {
    // Create test audit file path
    testAuditFile = path.join(process.cwd(), 'test-integration-audit.json');
    
    // Mock the server to use test audit file
    server = new SmartSuiteShimServer();
    
    // Replace the audit logger with our test instance
    (server as any).auditLogger = new AuditLogger(testAuditFile);
    auditLogger = (server as any).auditLogger;

    // Mock the SmartSuite client methods to avoid real API calls
    const mockClient = {
      createRecord: vi.fn().mockResolvedValue({ id: 'new-record-123', name: 'Test Record' }),
      updateRecord: vi.fn().mockResolvedValue({ id: 'record-123', name: 'Updated Record' }),
      deleteRecord: vi.fn().mockResolvedValue(undefined),
      getRecord: vi.fn().mockResolvedValue({ id: 'record-123', name: 'Original Record', value: 100 }),
      listRecords: vi.fn(),
      countRecords: vi.fn()
    };

    (server as any).client = mockClient;
  });

  afterEach(async () => {
    // Clean up test audit file
    if (await fs.pathExists(testAuditFile)) {
      await fs.remove(testAuditFile);
    }
    vi.restoreAllMocks();
  });

  describe('Create Operation Auditing', () => {
    it('should audit create operations through MCP server', async () => {
      // First perform a dry-run to satisfy validation requirements
      const dryRunResult = await server.executeTool('smartsuite_record', {
        operation: 'create',
        appId: '507f1f77bcf86cd799439011', // Valid MongoDB ObjectId format
        data: { name: 'Test Record', value: 42 },
        dry_run: true
      });

      expect(dryRunResult).toBeDefined();

      // Now perform the actual create operation
      const result = await server.executeTool('smartsuite_record', {
        operation: 'create',
        appId: '507f1f77bcf86cd799439011',
        data: { name: 'Test Record', value: 42 },
        dry_run: false
      });

      expect(result).toBeDefined();

      // Verify audit entry was created
      const auditEntries = await auditLogger.getEntries();
      expect(auditEntries).toHaveLength(1);

      const entry = auditEntries[0];
      expect(entry.operation).toBe('create');
      expect(entry.tableId).toBe('507f1f77bcf86cd799439011');
      expect(entry.recordId).toBe('new-record-123');
      expect(entry.payload).toEqual({ name: 'Test Record', value: 42 });
      expect(entry.result).toEqual({ id: 'new-record-123', name: 'Test Record' });
      expect(entry.reversalInstructions.operation).toBe('delete');
      expect(entry.hash).toBeDefined();
      expect(entry.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Update Operation Auditing', () => {
    it('should audit update operations with beforeData', async () => {
      // First perform a dry-run
      await server.executeTool('smartsuite_record', {
        operation: 'update',
        appId: '507f1f77bcf86cd799439011',
        recordId: 'record-123',
        data: { name: 'Updated Record', value: 200 },
        dry_run: true
      });

      // Perform actual update operation
      const result = await server.executeTool('smartsuite_record', {
        operation: 'update',
        appId: '507f1f77bcf86cd799439011',
        recordId: 'record-123',
        data: { name: 'Updated Record', value: 200 },
        dry_run: false
      });

      expect(result).toBeDefined();

      // Verify audit entry
      const auditEntries = await auditLogger.getEntries();
      expect(auditEntries).toHaveLength(1);

      const entry = auditEntries[0];
      expect(entry.operation).toBe('update');
      expect(entry.tableId).toBe('507f1f77bcf86cd799439011');
      expect(entry.recordId).toBe('record-123');
      expect(entry.payload).toEqual({ name: 'Updated Record', value: 200 });
      expect(entry.beforeData).toEqual({ id: 'record-123', name: 'Original Record', value: 100 });
      expect(entry.reversalInstructions.operation).toBe('update');
      expect(entry.reversalInstructions.payload).toEqual({ id: 'record-123', name: 'Original Record', value: 100 });
    });
  });

  describe('Delete Operation Auditing', () => {
    it('should audit delete operations with recovery data', async () => {
      // First perform a dry-run
      await server.executeTool('smartsuite_record', {
        operation: 'delete',
        appId: '507f1f77bcf86cd799439011',
        recordId: 'record-123',
        dry_run: true
      });

      // Perform actual delete operation
      const result = await server.executeTool('smartsuite_record', {
        operation: 'delete',
        appId: '507f1f77bcf86cd799439011',
        recordId: 'record-123',
        dry_run: false
      });

      expect(result).toEqual({ deleted: 'record-123' });

      // Verify audit entry
      const auditEntries = await auditLogger.getEntries();
      expect(auditEntries).toHaveLength(1);

      const entry = auditEntries[0];
      expect(entry.operation).toBe('delete');
      expect(entry.tableId).toBe('507f1f77bcf86cd799439011');
      expect(entry.recordId).toBe('record-123');
      expect(entry.beforeData).toEqual({ id: 'record-123', name: 'Original Record', value: 100 });
      expect(entry.reversalInstructions.operation).toBe('create');
      expect(entry.reversalInstructions.payload).toEqual({ id: 'record-123', name: 'Original Record', value: 100 });
    });
  });

  describe('Audit Trail Persistence', () => {
    it('should persist audit entries to the correct file location', async () => {
      // Perform a create operation
      await server.executeTool('smartsuite_record', {
        operation: 'create',
        appId: '507f1f77bcf86cd799439011',
        data: { name: 'Test Record' },
        dry_run: true
      });

      await server.executeTool('smartsuite_record', {
        operation: 'create',
        appId: '507f1f77bcf86cd799439011',
        data: { name: 'Test Record' },
        dry_run: false
      });

      // Verify file was created
      expect(await fs.pathExists(testAuditFile)).toBe(true);

      // Verify file content
      const fileContent = await fs.readJson(testAuditFile);
      expect(fileContent).toBeInstanceOf(Array);
      expect(fileContent).toHaveLength(1);
      expect(fileContent[0].operation).toBe('create');
    });

    it('should handle multiple operations in sequence', async () => {
      // Create record
      await server.executeTool('smartsuite_record', {
        operation: 'create',
        appId: '507f1f77bcf86cd799439011',
        data: { name: 'Test Record' },
        dry_run: true
      });

      await server.executeTool('smartsuite_record', {
        operation: 'create',
        appId: '507f1f77bcf86cd799439011',
        data: { name: 'Test Record' },
        dry_run: false
      });

      // Update record
      await server.executeTool('smartsuite_record', {
        operation: 'update',
        appId: '507f1f77bcf86cd799439011',
        recordId: 'new-record-123',
        data: { name: 'Updated Record' },
        dry_run: true
      });

      await server.executeTool('smartsuite_record', {
        operation: 'update',
        appId: '507f1f77bcf86cd799439011',
        recordId: 'new-record-123',
        data: { name: 'Updated Record' },
        dry_run: false
      });

      // Delete record
      await server.executeTool('smartsuite_record', {
        operation: 'delete',
        appId: '507f1f77bcf86cd799439011',
        recordId: 'new-record-123',
        dry_run: true
      });

      await server.executeTool('smartsuite_record', {
        operation: 'delete',
        appId: '507f1f77bcf86cd799439011',
        recordId: 'new-record-123',
        dry_run: false
      });

      // Verify all operations were audited
      const auditEntries = await auditLogger.getEntries();
      expect(auditEntries).toHaveLength(3);
      expect(auditEntries[0].operation).toBe('create');
      expect(auditEntries[1].operation).toBe('update');
      expect(auditEntries[2].operation).toBe('delete');
    });
  });

  describe('Compliance Report Generation', () => {
    beforeEach(async () => {
      // Set up audit entries for compliance testing
      const operations = [
        {
          operation: 'create' as const,
          appId: '507f1f77bcf86cd799439011',
          data: { name: 'John Doe', email: 'john@example.com' }
        },
        {
          operation: 'update' as const,
          appId: '507f1f77bcf86cd799439011',
          recordId: 'new-record-123',
          data: { email: 'john.doe@example.com' }
        },
        {
          operation: 'delete' as const,
          appId: '507f1f77bcf86cd799439011',
          recordId: 'new-record-123'
        }
      ];

      for (const op of operations) {
        await server.executeTool('smartsuite_record', { ...op, dry_run: true });
        await server.executeTool('smartsuite_record', { ...op, dry_run: false });
      }
    });

    it('should generate SOC2 compliance reports', async () => {
      const report = await auditLogger.generateComplianceReport('SOC2');

      expect(report.standard).toBe('SOC2');
      expect(report.totalOperations).toBe(3);
      expect(report.operationsByType.create).toBe(1);
      expect(report.operationsByType.update).toBe(1);
      expect(report.operationsByType.delete).toBe(1);
      expect(report.affectedTables).toContain('507f1f77bcf86cd799439011');
      expect(report.retentionAnalysis.totalEntries).toBe(3);
    });

    it('should generate GDPR compliance reports', async () => {
      const report = await auditLogger.generateComplianceReport('GDPR');

      expect(report.standard).toBe('GDPR');
      expect(report.personalDataOperations).toBeDefined();
      expect(report.personalDataOperations!.length).toBeGreaterThan(0);
      expect(report.dataSubjects).toContain('new-record-123');
      expect(report.rightToErasure).toBeDefined();
    });
  });
});