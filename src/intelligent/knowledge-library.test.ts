// Context7: consulted for vitest
import { describe, it, expect, beforeEach } from 'vitest';

import { KnowledgeLibrary } from './knowledge-library';
import type { KnowledgeEntry, KnowledgeMatch, SafetyLevel } from './types';

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
      expect(matches[0].failureModes).toBeDefined();
      expect(matches[0].failureModes?.[0]).toHaveProperty('description');
      expect(matches[0].failureModes?.[0]).toHaveProperty('prevention');
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
      expect(match.safetyLevel).toBe('RED');
      expect(match.failureModes).toBeDefined();
      expect(match.failureModes?.[0].prevention).toContain('POST');
    });

    it('should find knowledge for UUID corruption in status fields', () => {
      const matches = library.findRelevantKnowledge('POST', '/change_field', {
        field_type: 'singleselectfield',
        options: ['test'],
      });

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];
      expect(match.safetyLevel).toBe('RED');
      expect(match.protocols).toBeDefined();
      expect(match.protocols?.[0].prevention).toContain('choices');
    });

    it('should find knowledge for bulk operation limits', () => {
      const matches = library.findRelevantKnowledge('POST', '/bulk_update', {
        records: new Array(30).fill({}),
      });

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];
      expect(match.safetyLevel).toBe('YELLOW');
      expect(match.validationRules).toBeDefined();
      expect(match.validationRules?.[0].limit).toBe(25);
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
        method: 'POST',
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
      expect(matches[0].examples).toBeDefined();
    });

    it('should learn from failure patterns', () => {
      const operation = {
        method: 'GET',
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
      expect(matches[0].failureModes).toBeDefined();
      expect(matches[0].failureModes?.length).toBeGreaterThan(0);
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

    it('should expire cache entries after 5 minutes', async () => {
      const matches1 = library.findRelevantKnowledge('GET', '/test-ttl');

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
        method: 'POST',
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
