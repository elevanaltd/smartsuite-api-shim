// Context7: consulted for vitest
import { describe, it, expect, beforeEach } from 'vitest';

import { KnowledgeLibrary } from './knowledge-library';
import { SafetyEngine } from './safety-engine';
import type {
  IntelligentToolInput,
  KnowledgeMatch,
  SafetyAssessment,
  SafetyProtocol,
} from './types';

describe('SafetyEngine', () => {
  let engine: SafetyEngine;
  let knowledgeLibrary: KnowledgeLibrary;

  beforeEach(async () => {
    knowledgeLibrary = new KnowledgeLibrary();
    await knowledgeLibrary.loadFromResearch('./src/knowledge');
    engine = new SafetyEngine(knowledgeLibrary);
  });

  describe('assess', () => {
    it('should assess RED level for UUID corruption risk', () => {
      const operation: IntelligentToolInput = {
        mode: 'learn',
        method: 'POST',
        endpoint: '/change_field',
        payload: {
          field_type: 'singleselectfield',
          options: ['Option1', 'Option2'], // This should trigger RED safety
        },
        operationDescription: 'Update status field options',
      };

      const knowledge = knowledgeLibrary.findRelevantKnowledge(
        operation.method,
        operation.endpoint,
        operation.payload,
      );

      const assessment = engine.assess(operation, knowledge);

      expect(assessment.level).toBe('RED');
      expect(assessment.blockers).toHaveLength(1);
      expect(assessment.blockers[0]).toContain('UUID');
      expect(assessment.recommendations).toContain('Use "choices" parameter instead of "options"');
    });

    it('should assess YELLOW level for bulk operation over limit', () => {
      const operation: IntelligentToolInput = {
        mode: 'dry_run',
        method: 'POST',
        endpoint: '/bulk_update',
        payload: {
          records: new Array(30).fill({ name: 'Test' }),
        },
        operationDescription: 'Bulk update 30 records',
      };

      const knowledge = knowledgeLibrary.findRelevantKnowledge(
        operation.method,
        operation.endpoint,
        operation.payload,
      );

      const assessment = engine.assess(operation, knowledge);

      expect(assessment.level).toBe('YELLOW');
      expect(assessment.warnings).toHaveLength(1);
      expect(assessment.warnings[0].message).toContain('25 records');
      expect(assessment.recommendations).toContain('Split into batches of 25 records or less');
    });

    it('should assess GREEN level for safe operations', () => {
      const operation: IntelligentToolInput = {
        mode: 'learn',
        method: 'POST',
        endpoint: '/applications/123/records/list/',
        payload: { filter: {} },
        operationDescription: 'List records with filter',
      };

      const knowledge = knowledgeLibrary.findRelevantKnowledge(
        operation.method,
        operation.endpoint,
        operation.payload,
      );

      const assessment = engine.assess(operation, knowledge);

      expect(assessment.level).toBe('GREEN');
      expect(assessment.blockers).toHaveLength(0);
      expect(assessment.warnings).toHaveLength(0);
      expect(assessment.score).toBeGreaterThan(80);
    });

    it('should block RED operations in execute mode without confirmation', () => {
      const operation: IntelligentToolInput = {
        mode: 'execute',
        method: 'POST',
        endpoint: '/change_field',
        payload: {
          field_type: 'singleselectfield',
          options: ['Option1'],
        },
        operationDescription: 'Update field',
        confirmed: false,
      };

      const knowledge = knowledgeLibrary.findRelevantKnowledge(
        operation.method,
        operation.endpoint,
        operation.payload,
      );

      const assessment = engine.assess(operation, knowledge);

      expect(assessment.level).toBe('RED');
      expect(assessment.blockers).toContain('RED level operation requires confirmation');
    });

    it('should allow RED operations in execute mode with confirmation', () => {
      const operation: IntelligentToolInput = {
        mode: 'execute',
        method: 'POST',
        endpoint: '/change_field',
        payload: {
          field_type: 'singleselectfield',
          options: ['Option1'],
        },
        operationDescription: 'Update field',
        confirmed: true,
      };

      const knowledge = knowledgeLibrary.findRelevantKnowledge(
        operation.method,
        operation.endpoint,
        operation.payload,
      );

      const assessment = engine.assess(operation, knowledge);

      expect(assessment.level).toBe('RED');
      expect(assessment.blockers).not.toContain('RED level operation requires confirmation');
      expect(assessment.warnings[0].level).toBe('CRITICAL');
    });
  });

  describe('validateCriticalProtocols', () => {
    it('should validate UUID protection protocol', () => {
      const operation: IntelligentToolInput = {
        mode: 'learn',
        method: 'POST',
        endpoint: '/change_field',
        payload: {
          field_type: 'singleselectfield',
          options: ['test'],
        },
        operationDescription: 'Test',
      };

      const validations = engine.validateCriticalProtocols(operation);

      expect(validations).toHaveLength(1);
      expect(validations[0].passed).toBe(false);
      expect(validations[0].protocol).toBe('UUID_PROTECTION');
      expect(validations[0].message).toContain('UUID corruption risk');
    });

    it('should validate bulk operation limits', () => {
      const operation: IntelligentToolInput = {
        mode: 'learn',
        method: 'POST',
        endpoint: '/bulk',
        payload: {
          records: new Array(50).fill({}),
        },
        operationDescription: 'Test',
      };

      const validations = engine.validateCriticalProtocols(operation);

      expect(validations).toHaveLength(1);
      expect(validations[0].passed).toBe(false);
      expect(validations[0].protocol).toBe('BULK_OPERATION_LIMITS');
      expect(validations[0].message).toContain('exceeds limit of 25');
    });

    it('should validate endpoint correctness', () => {
      const operation: IntelligentToolInput = {
        mode: 'learn',
        method: 'GET',
        endpoint: '/applications/123/records',
        operationDescription: 'Test',
      };

      const validations = engine.validateCriticalProtocols(operation);

      expect(validations).toHaveLength(1);
      expect(validations[0].passed).toBe(false);
      expect(validations[0].protocol).toBe('ENDPOINT_VALIDATION');
      expect(validations[0].message).toContain('Wrong HTTP method');
    });
  });

  describe('generateWarnings', () => {
    it('should generate critical warnings for RED assessments', () => {
      const assessment: SafetyAssessment = {
        level: 'RED',
        score: 10,
        protocols: [],
        warnings: [],
        blockers: ['UUID corruption risk'],
        recommendations: [],
      };

      const warnings = engine.generateWarnings(assessment);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('CRITICAL');
      expect(warnings[0].message).toContain('HIGH RISK');
    });

    it('should generate warnings for YELLOW assessments', () => {
      const assessment: SafetyAssessment = {
        level: 'YELLOW',
        score: 50,
        protocols: [],
        warnings: [],
        blockers: [],
        recommendations: [],
      };

      const warnings = engine.generateWarnings(assessment);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('WARNING');
      expect(warnings[0].message).toContain('Moderate risk');
    });

    it('should generate info for GREEN assessments', () => {
      const assessment: SafetyAssessment = {
        level: 'GREEN',
        score: 90,
        protocols: [],
        warnings: [],
        blockers: [],
        recommendations: [],
      };

      const warnings = engine.generateWarnings(assessment);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('INFO');
      expect(warnings[0].message).toContain('Safe operation');
    });
  });
});
