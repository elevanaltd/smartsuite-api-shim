// Critical-Engineer: consulted for Knowledge base architecture and agent guidance patterns
// Context7: consulted for fs - Node.js built-in file system module for reading JSON files in tests
// Context7: consulted for path - Node.js built-in path module for cross-platform file path handling  
// Context7: consulted for vitest - Test framework for TypeScript/JavaScript unit testing
// Test for agent guidance pattern validation and trigger matching

import fs from 'fs';
import path from 'path';
import { describe, test, expect, beforeAll } from 'vitest';

interface AgentGuidancePattern {
  version: string;
  status: string;
  last_updated: string;
  author: string;
  trigger_phrases: string[];
  intent_summary: string;
  prevention_message: string;
  negative_matches?: string[];
  working_example?: any;
  never_use_operators?: string[];
  array_syntax_examples?: any;
}

interface AgentGuidanceFile {
  _metadata: {
    version: string;
    created: string;
    author: string;
  };
  _schema_validation: {
    required_fields: string[];
  };
  PROJECT_VIDEO_FILTERING_PATTERN: AgentGuidancePattern;
  DISCOVERY_FIRST_WORKFLOW_PATTERN: AgentGuidancePattern;
  FILTER_SYNTAX_DISAMBIGUATION_PATTERN: AgentGuidancePattern;
  LINKED_RECORD_QUERY_BEST_PRACTICES: AgentGuidancePattern;
  FIELD_NAME_GUESSING_PREVENTION: AgentGuidancePattern;
  DEBUGGING_CYCLE_PREVENTION: AgentGuidancePattern;
}

describe('Agent Guidance Patterns', () => {
  let agentGuidance: AgentGuidanceFile;

  beforeAll(() => {
    // Load the agent guidance file - this should FAIL until we create it
    const guidanceFile = path.join(__dirname, '../src/knowledge/agent-guidance.json');
    expect(fs.existsSync(guidanceFile)).toBe(true);
    agentGuidance = JSON.parse(fs.readFileSync(guidanceFile, 'utf8'));
  });

  describe('File Structure Validation', () => {
    test('should have required metadata fields', () => {
      expect(agentGuidance._metadata).toBeDefined();
      expect(agentGuidance._metadata.version).toBeDefined();
      expect(agentGuidance._metadata.created).toBeDefined();
      expect(agentGuidance._metadata.author).toBeDefined();
    });

    test('should have schema validation rules', () => {
      expect(agentGuidance._schema_validation).toBeDefined();
      expect(agentGuidance._schema_validation.required_fields).toContain('trigger_phrases');
      expect(agentGuidance._schema_validation.required_fields).toContain('prevention_message');
    });

    test('should be valid JSON', () => {
      // If we got this far, JSON parsing succeeded
      expect(typeof agentGuidance).toBe('object');
      expect(agentGuidance).not.toBeNull();
    });
  });

  describe('Pattern Structure Validation', () => {
    const patternNames: (keyof AgentGuidanceFile)[] = [
      'PROJECT_VIDEO_FILTERING_PATTERN',
      'DISCOVERY_FIRST_WORKFLOW_PATTERN', 
      'FILTER_SYNTAX_DISAMBIGUATION_PATTERN',
      'LINKED_RECORD_QUERY_BEST_PRACTICES',
      'FIELD_NAME_GUESSING_PREVENTION',
      'DEBUGGING_CYCLE_PREVENTION'
    ];

    test.each(patternNames)('pattern %s should have required fields', (patternName) => {
      const pattern = agentGuidance[patternName] as AgentGuidancePattern;
      expect(pattern).toBeDefined();
      expect(pattern.trigger_phrases).toBeDefined();
      expect(Array.isArray(pattern.trigger_phrases)).toBe(true);
      expect(pattern.prevention_message).toBeDefined();
      expect(pattern.version).toBeDefined();
      expect(pattern.status).toBe('active');
      expect(pattern.intent_summary).toBeDefined();
    });

    test.each(patternNames)('pattern %s should have metadata', (patternName) => {
      const pattern = agentGuidance[patternName] as AgentGuidancePattern;
      expect(pattern.last_updated).toBeDefined();
      expect(pattern.author).toBeDefined();
      expect(pattern.version).toMatch(/^\d+\.\d+$/); // Semantic versioning
    });
  });

  describe('Trigger Phrase Matching', () => {
    test('PROJECT_VIDEO_FILTERING_PATTERN should match project video queries', () => {
      const pattern = agentGuidance.PROJECT_VIDEO_FILTERING_PATTERN;
      const triggers = pattern.trigger_phrases;
      
      expect(triggers).toContain('get videos for project');
      expect(triggers).toContain('filter videos by project');
      expect(triggers).toContain('project videos');
    });

    test('DISCOVERY_FIRST_WORKFLOW_PATTERN should match linked record queries', () => {
      const pattern = agentGuidance.DISCOVERY_FIRST_WORKFLOW_PATTERN;
      const triggers = pattern.trigger_phrases;
      
      expect(triggers).toContain('filter by linked record');
      expect(triggers).toContain('query related records');
      expect(triggers).toContain('associated records');
    });

    test('FILTER_SYNTAX_DISAMBIGUATION_PATTERN should match error scenarios', () => {
      const pattern = agentGuidance.FILTER_SYNTAX_DISAMBIGUATION_PATTERN;
      const triggers = pattern.trigger_phrases;
      
      expect(triggers).toContain('Bad Request on filter');
      expect(triggers).toContain('400 error on query');
      expect(triggers).toContain('filter syntax error');
    });
  });

  describe('Working Examples Validation', () => {
    test('PROJECT_VIDEO_FILTERING_PATTERN should have complete working example', () => {
      const pattern = agentGuidance.PROJECT_VIDEO_FILTERING_PATTERN;
      expect(pattern.working_example).toBeDefined();
      expect(pattern.working_example.discovery_call).toBeDefined();
      expect(pattern.working_example.filter_call).toBeDefined();
      
      const discovery = pattern.working_example.discovery_call;
      expect(discovery.tool).toBe('smartsuite_discover');
      expect(discovery.params.scope).toBe('fields');
      
      const filter = pattern.working_example.filter_call;
      expect(filter.tool).toBe('smartsuite_query');
      expect(filter.params.operation).toBe('list');
    });

    test('Linked record examples should use correct operators', () => {
      const pattern = agentGuidance.LINKED_RECORD_QUERY_BEST_PRACTICES;
      const examples = pattern.array_syntax_examples;
      
      expect(examples.single_link.comparison).toBe('has_any_of');
      expect(examples.multiple_links.comparison).toBe('has_all_of');
      expect(examples.exclusion.comparison).toBe('has_none_of');
      
      // Values should be arrays
      expect(Array.isArray(examples.single_link.value)).toBe(true);
      expect(Array.isArray(examples.multiple_links.value)).toBe(true);
      expect(Array.isArray(examples.exclusion.value)).toBe(true);
    });
  });

  describe('Anti-Pattern Prevention', () => {
    test('should define negative matches to prevent false triggers', () => {
      const pattern = agentGuidance.PROJECT_VIDEO_FILTERING_PATTERN;
      expect(pattern.negative_matches).toBeDefined();
      expect(Array.isArray(pattern.negative_matches)).toBe(true);
      expect(pattern.negative_matches).toContain('filter out project videos');
    });

    test('LINKED_RECORD_QUERY_BEST_PRACTICES should list forbidden operators', () => {
      const pattern = agentGuidance.LINKED_RECORD_QUERY_BEST_PRACTICES;
      expect(pattern.never_use_operators).toBeDefined();
      expect(pattern.never_use_operators).toContain('is');
      expect(pattern.never_use_operators).toContain('equals');
      expect(pattern.never_use_operators).toContain('contains');
    });
  });

  describe('Pattern Separation from API Patterns', () => {
    test('should be in separate file from api-patterns.json', () => {
      const apiPatternsFile = path.join(__dirname, '../src/knowledge/api-patterns.json');
      expect(fs.existsSync(apiPatternsFile)).toBe(true);
      
      const apiPatterns = JSON.parse(fs.readFileSync(apiPatternsFile, 'utf8'));
      
      // Agent guidance patterns should NOT be in api-patterns.json
      expect(apiPatterns.AGENT_GUIDANCE_PATTERNS).toBeUndefined();
      expect(apiPatterns.PROJECT_VIDEO_FILTERING_PATTERN).toBeUndefined();
    });

    test('should maintain architectural separation of concerns', () => {
      // This file should contain behavioral guidance, not API specifications
      const guidanceKeys = Object.keys(agentGuidance).filter(key => !key.startsWith('_'));
      
      guidanceKeys.forEach(key => {
        const pattern = (agentGuidance as any)[key];
        // Should have behavioral guidance fields
        expect(pattern.trigger_phrases || pattern.intent_summary).toBeDefined();
        expect(pattern.prevention_message).toBeDefined();
        
        // Should NOT have API endpoint specifications
        expect(pattern.endpoint).toBeUndefined();
        expect(pattern.method).toBeUndefined(); 
        expect(pattern.required_headers).toBeUndefined();
      });
    });
  });
});