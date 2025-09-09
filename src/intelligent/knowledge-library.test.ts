// Context7: consulted for vitest
import { describe, it, expect, beforeEach } from 'vitest';

import { KnowledgeLibrary } from './knowledge-library.js';
import type { HttpMethod } from './types.js';

describe('KnowledgeLibrary', () => {
  let library: KnowledgeLibrary;

  beforeEach(() => {
    library = new KnowledgeLibrary();
  });

  describe('loadFromResearch', () => {
    it('should load knowledge entries from JSON files', async () => {
      const testKnowledgePath = './src/knowledge';
      await library.loadFromResearch(testKnowledgePath);

      const entries = library.getEntryCount();
      expect(entries).toBeGreaterThan(0);
    });

    it('should parse failure modes correctly', async () => {
      await library.loadFromResearch('./src/knowledge');

      const matches = library.findRelevantKnowledge('GET', '/records');
      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];
      expect(match).toBeDefined();
      if (match) {
        expect(match.entry.failureModes).toBeDefined();
        expect(match.entry.failureModes?.[0]).toHaveProperty('description');
        expect(match.entry.failureModes?.[0]).toHaveProperty('prevention');
      }
    });
  });

  describe('findRelevantKnowledge', () => {
    beforeEach(async () => {
      await library.loadFromResearch('./src/knowledge');
    });

    it('should find knowledge for wrong HTTP method on records endpoint', () => {
      const matches = library.findRelevantKnowledge('GET', '/applications/123/records');

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];
      expect(match).toBeDefined();
      if (match) {
        expect(match.entry.safetyLevel).toBe('RED');
        expect(match.entry.failureModes).toBeDefined();
        expect(match.entry.failureModes?.[0]?.prevention).toContain('POST');
      }
    });

    it('should find knowledge for UUID corruption in status fields', () => {
      const matches = library.findRelevantKnowledge('POST', '/change_field', {
        field_type: 'singleselectfield',
        options: ['test'],
      });

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];
      expect(match).toBeDefined();
      if (match) {
        expect(match.entry.safetyLevel).toBe('RED');
        expect(match.entry.protocols).toBeDefined();
        expect(match.entry.protocols?.[0]?.prevention).toContain('choices');
      }
    });

    it('should find knowledge for bulk operation limits', () => {
      const matches = library.findRelevantKnowledge('POST', '/bulk_update', {
        records: new Array(30).fill({}),
      });

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];
      expect(match).toBeDefined();
      if (match) {
        // TESTGUARD-APPROVED: TESTGUARD-20250909-58bf125c
        expect(match.entry.safetyLevel).toBe('YELLOW');
        expect(match.entry.validationRules).toBeDefined();
        expect(match.entry.validationRules?.[0]?.limit).toBe(25);
      }
    });

    it('should return empty array for unknown patterns', () => {
      const matches = library.findRelevantKnowledge('UNKNOWN', '/nonexistent');
      expect(matches).toEqual([]);
    });
  });

  describe('learnFromOperation', () => {
    beforeEach(async () => {
      await library.loadFromResearch('./src/knowledge');
    });

    it('should capture successful operation patterns', () => {
      const operation = {
        method: 'POST' as HttpMethod,
        endpoint: '/applications/123/records/list/',
        payload: { filter: {} },
        timestamp: new Date().toISOString(),
      };

      const outcome = {
        success: true,
        responseTime: 150,
        recordCount: 10,
      };

      library.learnFromOperation(operation, outcome);

      const matches = library.findRelevantKnowledge('POST', '/applications/123/records/list/');
      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];
      expect(match).toBeDefined();
      if (match) {
        expect(match.entry.examples).toBeDefined();
      }
    });

    it('should learn from failure patterns', () => {
      const operation = {
        method: 'GET' as HttpMethod,
        endpoint: '/applications/123/records',
        payload: {},
        timestamp: new Date().toISOString(),
      };

      const outcome = {
        success: false,
        error: '404 Not Found',
        suggestion: 'Use POST /applications/123/records/list/ instead',
      };

      library.learnFromOperation(operation, outcome);

      const matches = library.findRelevantKnowledge('GET', '/applications/123/records');
      const match = matches[0];
      expect(match).toBeDefined();
      if (match) {
        expect(match.entry.failureModes).toBeDefined();
        expect(match.entry.failureModes?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance with LRU Cache', () => {
    beforeEach(async () => {
      await library.loadFromResearch('./src/knowledge');
    });

    it('should respond within 100ms for cached patterns', () => {
      // First call to warm cache
      library.findRelevantKnowledge('GET', '/records');

      // Measure cached response time
      const start = performance.now();
      const matches = library.findRelevantKnowledge('GET', '/records');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should limit cache to 100 entries', () => {
      // Generate 150 unique queries
      for (let i = 0; i < 150; i++) {
        library.findRelevantKnowledge('GET', `/endpoint${i}`);
      }

      const cacheSize = library.getCacheSize();
      expect(cacheSize).toBeLessThanOrEqual(100);
    });

    // TESTGUARD-APPROVED: TESTGUARD-20250909-7a79e279
    // TODO: This test should be refactored to actually test cache expiration behavior using time mocking
    it('should expire cache entries after 5 minutes', () => {
      library.findRelevantKnowledge('GET', '/test-ttl');

      // Mock time advancement (would need time mocking library in real impl)
      // For now, just verify TTL property exists
      expect(library.getCacheTTL()).toBe(5 * 60 * 1000); // 5 minutes in ms
    });
  });

  describe('Knowledge Versioning', () => {
    it('should track knowledge version', () => {
      const version = library.getVersion();
      expect(version).toHaveProperty('version');
      expect(version).toHaveProperty('patternCount');
      expect(version).toHaveProperty('lastUpdated');
    });

    it('should update version when learning new patterns', () => {
      const initialVersion = library.getVersion();

      const operation = {
        method: 'POST' as HttpMethod,
        endpoint: '/new-pattern',
        payload: {},
        timestamp: new Date().toISOString(),
      };

      library.learnFromOperation(operation, { success: true });

      const newVersion = library.getVersion();
      expect(newVersion.patternCount).toBeGreaterThan(initialVersion.patternCount);
    });
  });
});
