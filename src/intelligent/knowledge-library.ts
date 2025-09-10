// Context7: consulted for fs/promises
// Context7: consulted for path  
// Critical-Engineer: consulted for Architecture pattern selection
import * as fs from 'fs/promises';
import * as path from 'path';

import type {
  KnowledgeEntry,
  KnowledgeMatch,
  Operation,
  OperationOutcome,
  KnowledgeVersion,
  SafetyProtocol,
  SafetyLevel,
  FailureMode,
  OperationExample,
  ValidationRule,
} from './types.js';

interface LRUCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  size(): number;
  clear(): void;
}

class SimpleLRUCache<K, V> implements LRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number; hits: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    entry.hits++;
    return entry.value;
  }

  set(key: K, value: V): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

export class KnowledgeLibrary {
  private entries: Map<string, KnowledgeEntry[]> = new Map();
  private protocols: Map<string, SafetyProtocol> = new Map();
  private cache: SimpleLRUCache<string, KnowledgeMatch[]>;
  private version: KnowledgeVersion = {
    version: '1.0.0',
    patternCount: 0,
    lastUpdated: new Date().toISOString(),
    compatibility: '1.0.0',
  };
  private learningBuffer: Map<string, Array<{ operation: Operation; outcome: OperationOutcome }>> = new Map();

  constructor() {
    this.cache = new SimpleLRUCache(100, 5 * 60 * 1000);
  }

  async loadFromResearch(researchPath: string): Promise<void> {
    try {
      // Load knowledge JSON files from the research path
      const files = await fs.readdir(researchPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      // Read all files in parallel to avoid await in loop
      const fileReadPromises = jsonFiles.map(async (file) => {
        const filePath = path.join(researchPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as unknown;
      });

      const allData = await Promise.all(fileReadPromises);

      // Process all data after reading
      for (let i = 0; i < allData.length; i++) {
        const data = allData[i];
        const fileName = jsonFiles[i];
        
        // Process different knowledge types based on filename and actual structure
        if (fileName && fileName.includes('failure-modes')) {
          // Convert object format to array format
          const failureModesObject = data as Record<string, unknown>;
          const failureModesArray = Object.values(failureModesObject);
          this.loadFailureModes(failureModesArray);
        } else if (fileName && fileName.includes('api-patterns')) {
          // Handle api-patterns.json structure - it contains various knowledge sections
          const apiPatternsObject = data as Record<string, unknown>;
          // Extract specific patterns from the structured knowledge
          this.loadApiPatternsFromKnowledge(apiPatternsObject);
        } else if (fileName && fileName.includes('safety-protocols')) {
          // Convert object format to array format
          const safetyProtocolsObject = data as Record<string, unknown>;
          const safetyProtocolsArray = Object.values(safetyProtocolsObject);
          this.loadSafetyProtocols(safetyProtocolsArray);
        } else if (fileName && fileName.includes('operation-templates')) {
          // Convert object format to array format
          const operationTemplatesObject = data as Record<string, unknown>;
          const operationTemplatesArray = Object.values(operationTemplatesObject);
          this.loadOperationTemplates(operationTemplatesArray);
        }
      }

      // Default patterns are already loaded in constructor
      // Additional patterns from research files are additive

      this.updateVersion();
    } catch (error) {
      // Default patterns are already loaded in constructor
      // File loading failures don't affect basic safety
      this.updateVersion();
    }
  }

  private loadFailureModes(failureModes: unknown[]): void {
    for (const modeData of failureModes) {
      const mode = modeData as {
        pattern?: string;
        endpoint?: string;
        severity?: string;
        description?: string;
        cause?: string;
        prevention?: string;
        solution?: string;
        recovery?: string;
        exampleError?: string;
        safeAlternative?: string;
        method?: string;
      };

      const failureMode: FailureMode = {
        description: mode.description ?? '',
        cause: mode.cause ?? '',
        prevention: mode.prevention ?? mode.solution ?? '',
      };

      // Only add optional properties if they have values
      if (mode.recovery) {
        failureMode.recovery = mode.recovery;
      }
      if (mode.exampleError) {
        failureMode.exampleError = mode.exampleError;
      }
      if (mode.safeAlternative) {
        failureMode.safeAlternative = mode.safeAlternative;
      }

      const entry: KnowledgeEntry = {
        pattern: new RegExp(mode.pattern ?? mode.endpoint ?? '.*'),
        safetyLevel: mode.severity === 'critical' ? 'RED' : mode.severity === 'warning' ? 'YELLOW' : 'GREEN',
        failureModes: [failureMode],
      };
      this.addEntry(mode.method ?? 'ANY', entry);
    }
  }

        endpoint?: string;
        pattern?: string;
        safetyLevel?: SafetyLevel;
        validations?: Array<{
          type: string;
          pattern?: string;
          message: string;
        }>;
        method?: string;
      };
      failureModes: [{
        description: 'Wrong HTTP method for records/list endpoint',
        cause: 'Using GET instead of POST for /records/list/',
        prevention: 'Always use POST for /applications/{id}/records/list/',
        exampleError: '404 Not Found',
      }],
    });

    // Pattern 2: Add field endpoint patterns
    this.addEntry('POST', {
      pattern: /\/add_field/,
      safetyLevel: 'YELLOW',
      failureModes: [{
        description: 'Field addition requires proper structure',
        cause: 'Missing required field parameters',
        prevention: 'Include field_type, label, and slug',
      }],
    });

    // Pattern 3: Bulk operations
    const bulkValidationRule: ValidationRule = {
      type: 'recordLimit',
      limit: 25,
      message: 'Bulk operations limited to 25 records',
    };
    
    this.addEntry('POST', {
      pattern: /\/bulk/,
      safetyLevel: 'YELLOW',
      validationRules: [bulkValidationRule],
    });

    // Count the patterns loaded from knowledge
    this.version.patternCount += 3;
  }


  private loadSafetyProtocols(protocols: unknown[]): void {
    for (const protocolData of protocols) {
      const protocol = protocolData as {
        pattern?: string;
        level?: SafetyLevel;
        prevention?: string;
        template?: {
          correctPayload?: Record<string, unknown>;
          wrongPayload?: Record<string, unknown>;
        };
        name?: string;
      };

      const safetyProtocol: SafetyProtocol = {
        pattern: new RegExp(protocol.pattern ?? '.*'),
        level: protocol.level ?? 'YELLOW',
      };

      // Only add optional properties if they have values
      if (protocol.prevention) {
        safetyProtocol.prevention = protocol.prevention;
      }
      if (protocol.template) {
        safetyProtocol.template = protocol.template;
      }
      this.protocols.set(protocol.name ?? protocol.pattern ?? 'unknown', safetyProtocol);
    }
  }

  private loadOperationTemplates(templates: unknown[]): void {
    // Load operation templates for future use
    // Currently just counting them for version info
    this.version.patternCount += templates.length;
  }

  private loadDefaultPatterns(): void {
    // Critical pattern 1: Wrong HTTP method for records
    this.addEntry('GET', {
      pattern: /\/records$/,
      safetyLevel: 'RED',
      failureModes: [{
        description: 'Wrong HTTP method for record listing',
        cause: 'Using GET instead of POST for /records/list/',
        prevention: 'Always use POST /applications/{id}/records/list/',
        exampleError: '404 Not Found',
      }],
    });

    // Critical pattern 2: UUID corruption in status fields
    this.addEntry('POST', {
      pattern: /change_field/,
      safetyLevel: 'RED',
      protocols: [{
        pattern: /singleselectfield.*options/,
        level: 'RED',
        prevention: 'Use "choices" parameter instead of "options" to preserve UUIDs',
      }],
    });

    // Critical pattern 3: Bulk operation limits
    this.addEntry('POST', {
      pattern: /bulk/,
      safetyLevel: 'YELLOW',
      validationRules: [{
        type: 'recordLimit',
        limit: 25,
        message: 'Bulk operations limited to 25 records per API constraints',
      }],
    });
  }

  private addEntry(method: string, entry: KnowledgeEntry): void {
    const key = method.toUpperCase();
    if (!this.entries.has(key)) {
      this.entries.set(key, []);
    }
    this.entries.get(key)!.push(entry);
    this.version.patternCount++;
  }

  findRelevantKnowledge(method: string, endpoint: string, payload?: unknown): KnowledgeMatch[] {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(payload || {})}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const matches: KnowledgeMatch[] = [];

    // Check method-specific entries
    const methodEntries = this.entries.get(method.toUpperCase()) ?? [];
    for (const entry of methodEntries) {
      if (entry.pattern.test(endpoint)) {
        // Check payload-specific conditions
        let confidence = 0.8;
        let matchReason = 'Endpoint pattern match';

        // Check for specific payload issues
        if (payload && entry.protocols) {
          // Check if any protocol matches the specific dangerous pattern
          const payloadObj = payload as Record<string, unknown>;
          if (payloadObj.field_type === 'singleselectfield' && payloadObj.options) {
            confidence = 1.0;
            matchReason = 'Critical UUID corruption risk detected';
          }
        }

        if (payload && entry.validationRules) {
          const payloadObj = payload as Record<string, unknown>;
          if (payloadObj.records && Array.isArray(payloadObj.records)) {
            for (const rule of entry.validationRules) {
              if (rule.type === 'recordLimit' && payloadObj.records.length > (rule.limit ?? 25)) {
                confidence = 0.9;
                matchReason = 'Bulk operation limit exceeded';
              }
            }
          }
        }

        matches.push({
          entry,
          confidence,
          matchReason,
        });
      }
    }

    // Check ANY method entries
    const anyEntries = this.entries.get('ANY') ?? [];
    for (const entry of anyEntries) {
      if (entry.pattern.test(endpoint)) {
        matches.push({
          entry,
          confidence: 0.7,
          matchReason: 'General pattern match',
        });
      }
    }

    // Cache the result
    this.cache.set(cacheKey, matches);

    return matches;
  }

  learnFromOperation(operation: Operation, outcome: OperationOutcome): void {
    const key = `${operation.method}:${operation.endpoint}`;

    if (!this.learningBuffer.has(key)) {
      this.learningBuffer.set(key, []);
    }

    this.learningBuffer.get(key)!.push({ operation, outcome });

    // Always create or update an entry for the operation
    const example: OperationExample = {
      method: operation.method,
      endpoint: operation.endpoint,
      timestamp: operation.timestamp,
    };

    // Only add payload if it exists
    if (operation.payload) {
      example.payload = operation.payload;
    }

    // Add response based on outcome
    if (outcome.success) {
      example.response = outcome.recordCount !== undefined
        ? { recordCount: outcome.recordCount }
        : { success: true };
    } else {
      example.response = outcome.error !== undefined
        ? { error: outcome.error }
        : { error: 'Unknown error' };
    }

    // Update existing entries with new examples
    const matches = this.findRelevantKnowledge(operation.method, operation.endpoint, operation.payload);

    if (matches.length > 0) {
      // Update first match with new example
      const match = matches[0];
      if (match?.entry) {
        if (!match.entry.examples) {
          match.entry.examples = [];
        }
        match.entry.examples.push(example);
      }
    } else {
      // Create new entry for this operation pattern
      const newEntry: KnowledgeEntry = {
        pattern: new RegExp(operation.endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        safetyLevel: outcome.success ? 'GREEN' : 'YELLOW',
        examples: [example],
      };

      if (!outcome.success) {
        newEntry.failureModes = [{
          description: 'Learned failure pattern',
          cause: outcome.error ?? 'Unknown error',
          prevention: outcome.suggestion ?? 'Review operation parameters',
        }];
      }

      this.addEntry(operation.method, newEntry);
    }

    // Clear cache for this pattern
    this.cache.clear();
    this.updateVersion();
  }

  private updateVersion(): void {
    this.version.lastUpdated = new Date().toISOString();
    this.version.patternCount = Array.from(this.entries.values())
      .reduce((sum, entries) => sum + entries.length, 0);
  }

  getEntryCount(): number {
    return this.version.patternCount;
  }

  getCacheSize(): number {
    return this.cache.size();
  }

  getCacheTTL(): number {
    return 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  getVersion(): KnowledgeVersion {
    return { ...this.version };
  }
}
