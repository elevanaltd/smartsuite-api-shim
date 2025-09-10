// TRACED: Implementation after failing tests - GREEN state
// Context7: consulted for fs-extra
// Context7: consulted for path
// Context7: consulted for crypto
import { createHash } from 'crypto';
import * as path from 'path';

import * as fs from 'fs-extra';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: 'create' | 'update' | 'delete';
  tableId: string;
  recordId: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  beforeData?: Record<string, unknown>;
  reversalInstructions: {
    operation: 'create' | 'update' | 'delete';
    tableId: string;
    recordId?: string;
    payload?: Record<string, unknown>;
  };
  hash: string;
}

export interface ComplianceReport {
  standard: 'SOC2' | 'GDPR';
  reportDate: Date;
  totalOperations: number;
  operationsByType: {
    create: number;
    update: number;
    delete: number;
  };
  affectedTables: string[];
  dateRange: {
    from: Date;
    to: Date;
  };
  retentionAnalysis: {
    oldestEntry: Date;
    newestEntry: Date;
    totalEntries: number;
  };
  // GDPR specific fields
  personalDataOperations?: AuditLogEntry[];
  dataSubjects?: string[];
  rightToErasure?: Array<{ recordId: string; tableId: string; reversible: boolean }>;
}

export interface MutationLogInput {
  operation: 'create' | 'update' | 'delete';
  tableId: string;
  recordId: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  beforeData?: Record<string, unknown>;
  reversalInstructions: {
    operation: 'create' | 'update' | 'delete';
    tableId: string;
    recordId?: string;
    payload?: Record<string, unknown>;
  };
}

export class AuditLogger {
  private readonly auditFilePath: string;
  private readonly lockFilePath: string;
  private readonly MAX_LOCK_WAIT_MS = 5000;

  constructor(auditFilePath: string) {
    this.auditFilePath = auditFilePath;
    this.lockFilePath = `${auditFilePath}.lock`;
  }

  async logMutation(input: MutationLogInput): Promise<void> {
    this.validateInput(input);

    const entry: AuditLogEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      operation: input.operation,
      tableId: input.tableId,
      recordId: input.recordId,
      ...(input.payload !== undefined && { payload: input.payload }),
      ...(input.result !== undefined && { result: input.result }),
      ...(input.beforeData !== undefined && { beforeData: input.beforeData }),
      reversalInstructions: input.reversalInstructions,
      hash: '', // Will be calculated after serialization
    };

    // Generate hash for integrity verification
    entry.hash = this.calculateEntryHash(entry);

    await this.persistEntry(entry);
  }

  async getEntries(): Promise<AuditLogEntry[]> {
    if (!(await fs.pathExists(this.auditFilePath))) {
      return [];
    }

    const entries = await fs.readJson(this.auditFilePath) as unknown[];
    return entries.map((entry) => this.deserializeEntry(entry));
  }

  async generateComplianceReport(standard: 'SOC2' | 'GDPR'): Promise<ComplianceReport> {
    const entries = await this.getEntries();

    if (entries.length === 0) {
      const now = new Date();
      return {
        standard,
        reportDate: now,
        totalOperations: 0,
        operationsByType: { create: 0, update: 0, delete: 0 },
        affectedTables: [],
        dateRange: { from: now, to: now },
        retentionAnalysis: { oldestEntry: now, newestEntry: now, totalEntries: 0 },
      };
    }

    const operationsByType = entries.reduce(
      (acc, entry) => {
        acc[entry.operation]++;
        return acc;
      },
      { create: 0, update: 0, delete: 0 },
    );

    const affectedTables = Array.from(new Set(entries.map(e => e.tableId)));
    const timestamps = entries.map(e => e.timestamp).sort((a, b) => a.getTime() - b.getTime());
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];

    // TypeScript strict mode - ensure timestamps exist before using
    if (!firstTimestamp || !lastTimestamp) {
      throw new Error('Invalid timestamp data in audit entries');
    }

    const baseReport: ComplianceReport = {
      standard,
      reportDate: new Date(),
      totalOperations: entries.length,
      operationsByType,
      affectedTables,
      dateRange: {
        from: firstTimestamp,
        to: lastTimestamp,
      },
      retentionAnalysis: {
        oldestEntry: firstTimestamp,
        newestEntry: lastTimestamp,
        totalEntries: entries.length,
      },
    };

    if (standard === 'GDPR') {
      // Filter for personal data operations (simple heuristic based on common field names)
      const personalDataOperations = entries.filter(entry =>
        this.containsPersonalData(entry.payload) ||
        this.containsPersonalData(entry.beforeData),
      );

      const dataSubjects = Array.from(new Set(entries.map(e => e.recordId)));

      const rightToErasure = entries
        .filter(e => e.operation === 'delete')
        .map(e => ({
          recordId: e.recordId,
          tableId: e.tableId,
          reversible: e.reversalInstructions.operation === 'create',
        }));

      return {
        ...baseReport,
        personalDataOperations,
        dataSubjects,
        rightToErasure,
      };
    }

    return baseReport;
  }

  private validateInput(input: MutationLogInput): void {
    if (!input.tableId || input.tableId.trim() === '') {
      throw new Error('tableId is required');
    }
    if (!input.recordId || input.recordId.trim() === '') {
      throw new Error('recordId is required');
    }
    if (!input.operation || !['create', 'update', 'delete'].includes(input.operation)) {
      throw new Error('operation must be create, update, or delete');
    }
    if (!input.reversalInstructions) {
      throw new Error('reversalInstructions is required');
    }
  }

  private generateEntryId(): string {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).substring(2, 10);
    return `audit-${timestamp}-${randomHex}`;
  }

  private calculateEntryHash(entry: Omit<AuditLogEntry, 'hash'>): string {
    const content = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      operation: entry.operation,
      tableId: entry.tableId,
      recordId: entry.recordId,
      payload: entry.payload,
      result: entry.result,
      beforeData: entry.beforeData,
      reversalInstructions: entry.reversalInstructions,
    });

    return createHash('sha256').update(content).digest('hex');
  }

  private async persistEntry(entry: AuditLogEntry): Promise<void> {
    await this.withFileLock(async () => {
      // Ensure directory exists
      await fs.ensureDir(path.dirname(this.auditFilePath));

      let entries: AuditLogEntry[] = [];

      // Read existing entries if file exists
      if (await fs.pathExists(this.auditFilePath)) {
        const rawEntries = await fs.readJson(this.auditFilePath) as unknown[];
        entries = rawEntries.map((entry) => this.deserializeEntry(entry));
      }

      // Append new entry
      entries.push(entry);

      // Write back to file (atomic operation via temp file)
      const tempFilePath = `${this.auditFilePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;
      await fs.writeJson(tempFilePath, entries, { spaces: 2 });

      // Atomic move - fs-extra move with overwrite option
      await fs.move(tempFilePath, this.auditFilePath, { overwrite: true });
    });
  }

  private async withFileLock<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const lockId = `${process.pid}-${Date.now()}-${Math.random()}`;

    // Wait for lock to be available
    // eslint-disable-next-line no-await-in-loop -- Intentional polling for lock availability
    while (await fs.pathExists(this.lockFilePath)) {
      if (Date.now() - startTime > this.MAX_LOCK_WAIT_MS) {
        throw new Error('File lock timeout exceeded');
      }
      // eslint-disable-next-line no-await-in-loop -- Intentional sleep for lock polling with jitter
      await this.sleep(10 + Math.random() * 40); // Add jitter to prevent thundering herd
    }

    // Acquire lock atomically
    try {
      await fs.writeFile(this.lockFilePath, lockId, { flag: 'wx' }); // wx = exclusive create
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        // Lock exists, retry
        await this.sleep(10);
        return this.withFileLock(operation);
      }
      throw error;
    }

    try {
      return await operation();
    } finally {
      // Release lock only if we still own it
      try {
        const currentLockId = await fs.readFile(this.lockFilePath, 'utf8');
        if (currentLockId === lockId) {
          await fs.remove(this.lockFilePath);
        }
      } catch {
        // Ignore errors when removing lock file
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private deserializeEntry(rawEntry: unknown): AuditLogEntry {
    const entry = rawEntry as Record<string, unknown>;
    return {
      ...(entry as Omit<AuditLogEntry, 'timestamp'>),
      timestamp: new Date(entry.timestamp as string),
    };
  }

  private containsPersonalData(data?: Record<string, unknown>): boolean {
    if (!data) return false;

    const personalDataFields = ['name', 'email', 'phone', 'address', 'ssn', 'passport', 'dob'];
    const keys = Object.keys(data).map(k => k.toLowerCase());

    return personalDataFields.some(field =>
      keys.some(key => key.includes(field)),
    );
  }
}
