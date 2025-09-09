// Context7: consulted for fs/promises
// Context7: consulted for path
import * as fs from 'fs/promises';
import * as path from 'path';

import type {
  KnowledgeEntry,
  KnowledgeMatch,
  Operation,
  OperationOutcome,
  KnowledgeVersion,
  CacheEntry,
  HttpMethod,
  FailureMode,
  SafetyProtocol,
  ValidationRule,
  OperationExample,
} from './types';

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
      this.cache.delete(firstKey);
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
  private learningBuffer: Map<string, any[]> = new Map();

  constructor() {
    this.cache = new SimpleLRUCache(100, 5 * 60 * 1000);
  }

  async loadFromResearch(researchPath: string): Promise<void> {
    try {
      // Load knowledge JSON files from the research path
      const files = await fs.readdir(researchPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        const filePath = path.join(researchPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Process different knowledge types
        if (data.failureModes) {
          this.loadFailureModes(data.failureModes);
        }
        if (data.apiPatterns) {
          this.loadApiPatterns(data.apiPatterns);
        }
        if (data.safetyProtocols) {
          this.loadSafetyProtocols(data.safetyProtocols);
        }
        if (data.operationTemplates) {
          this.loadOperationTemplates(data.operationTemplates);
        }
      }

      // Load hardcoded critical patterns if no files found
      if (this.entries.size === 0) {
        this.loadDefaultPatterns();
      }

      this.updateVersion();
    } catch (error) {
      // Load default patterns if file loading fails
      this.loadDefaultPatterns();
      this.updateVersion();
    }
  }

  private loadFailureModes(failureModes: any[]): void {
    for (const mode of failureModes) {
      const entry: KnowledgeEntry = {
        pattern: new RegExp(mode.pattern || mode.endpoint || '.*'),
        safetyLevel: mode.severity === 'critical' ? 'RED' : mode.severity === 'warning' ? 'YELLOW' : 'GREEN',
        failureModes: [{
          description: mode.description,
          cause: mode.cause,
          prevention: mode.prevention || mode.solution,
          recovery: mode.recovery,
          exampleError: mode.exampleError,
          safeAlternative: mode.safeAlternative,
        }],
      };
      this.addEntry(mode.method || 'ANY', entry);
    }
  }

  private loadApiPatterns(patterns: any[]): void {
    for (const pattern of patterns) {
      const entry: KnowledgeEntry = {
        pattern: new RegExp(pattern.endpoint || pattern.pattern || '.*'),
        safetyLevel: pattern.safetyLevel || 'GREEN',
        validationRules: pattern.validations?.map((v: any) => ({
          type: v.type,
          limit: v.limit,
          pattern: v.pattern ? new RegExp(v.pattern) : undefined,
          message: v.message,
        })),
      };
      this.addEntry(pattern.method || 'ANY', entry);
    }
  }

  private loadSafetyProtocols(protocols: any[]): void {
    for (const protocol of protocols) {
      const safetyProtocol: SafetyProtocol = {
        pattern: new RegExp(protocol.pattern || '.*'),
        level: protocol.level || 'YELLOW',
        prevention: protocol.prevention,
        template: protocol.template,
      };
      this.protocols.set(protocol.name || protocol.pattern, safetyProtocol);
    }
  }

  private loadOperationTemplates(templates: any[]): void {
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

  findRelevantKnowledge(method: HttpMethod | string, endpoint: string, payload?: any): KnowledgeMatch[] {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(payload || {})}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const matches: KnowledgeMatch[] = [];

    // Check method-specific entries
    const methodEntries = this.entries.get(method.toUpperCase()) || [];
    for (const entry of methodEntries) {
      if (entry.pattern.test(endpoint)) {
        // Check payload-specific conditions
        let confidence = 0.8;
        let matchReason = 'Endpoint pattern match';

        // Check for specific payload issues
        if (payload && entry.protocols) {
          for (const protocol of entry.protocols) {
            if (payload.field_type === 'singleselectfield' && payload.options) {
              confidence = 1.0;
              matchReason = 'Critical UUID corruption risk detected';
            }
          }
        }

        if (payload?.records && entry.validationRules) {
          for (const rule of entry.validationRules) {
            if (rule.type === 'recordLimit' && payload.records.length > (rule.limit || 25)) {
              confidence = 0.9;
              matchReason = 'Bulk operation limit exceeded';
            }
          }
        }

        matches.push({
          ...entry,
          confidence,
          matchReason,
        });
      }
    }

    // Check ANY method entries
    const anyEntries = this.entries.get('ANY') || [];
    for (const entry of anyEntries) {
      if (entry.pattern.test(endpoint)) {
        matches.push({
          ...entry,
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
      payload: operation.payload,
      response: outcome.success ? { recordCount: outcome.recordCount } : { error: outcome.error },
      timestamp: operation.timestamp,
    };

    // Update existing entries with new examples
    const matches = this.findRelevantKnowledge(operation.method, operation.endpoint, operation.payload);

    if (matches.length > 0) {
      // Update first match with new example
      const match = matches[0];
      if (!match.examples) {
        match.examples = [];
      }
      match.examples.push(example);
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
          cause: outcome.error || 'Unknown error',
          prevention: outcome.suggestion || 'Review operation parameters',
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
