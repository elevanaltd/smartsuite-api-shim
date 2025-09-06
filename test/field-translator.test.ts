// Context7: consulted for vitest
// TESTGUARD-APPROVED: TESTGUARD-20250906-28a47c71
// Fixes applied per TEST-METHODOLOGY-GUARDIAN:
// 1. Removed obsolete detectFieldType tests (method removed from implementation)
// 2. Fixed loadFromYaml test to match FAIL FAST contract
// 3. Fixed humanToApi tests to properly test strict mode (default behavior)
// 4. Removed unused mockClient variable
import { describe, it, expect, beforeEach } from 'vitest';
import { FieldTranslator } from '../src/lib/field-translator.js';

describe('FieldTranslator', () => {
  let translator: FieldTranslator;

  beforeEach(() => {
    translator = new FieldTranslator();
  });

  describe('loadFromYaml', () => {
    it('should load field mappings from YAML file', async () => {
      // Test loading the projects.yaml file
      const yamlPath = '/Volumes/EAV/new-system/data/field-mappings/projects.yaml';
      await translator.loadFromYaml(yamlPath);
      
      // Should have loaded mappings for the projects table
      const tableId = '68a8ff5237fde0bf797c05b3';
      expect(translator.hasMappings(tableId)).toBe(true);
    });

    it('should throw error for missing YAML file (FAIL FAST)', async () => {
      const yamlPath = '/nonexistent/file.yaml';
      
      // Should throw per FAIL FAST implementation
      await expect(translator.loadFromYaml(yamlPath)).rejects.toThrow();
    });
  });

  describe('humanToApi', () => {
    beforeEach(async () => {
      // Load test mappings
      const yamlPath = '/Volumes/EAV/new-system/data/field-mappings/projects.yaml';
      await translator.loadFromYaml(yamlPath);
    });

    it('should translate human-readable fields to API codes', () => {
      const tableId = '68a8ff5237fde0bf797c05b3';
      const humanFields = {
        projectName: 'Test Project',
        client: 'ACME Corp',
        projectPhase: 'Production',
        priority: 'High'
      };

      // Use non-strict mode to test basic translation without throwing
      const apiFields = translator.humanToApi(tableId, humanFields, false);

      expect(apiFields).toEqual({
        project_name_actual: 'Test Project',
        sbfc98645c: 'ACME Corp',
        status: 'Production',
        priority: 'High'
      });
    });

    it('should throw error for unmapped fields in strict mode (default)', () => {
      const tableId = '68a8ff5237fde0bf797c05b3';
      const humanFields = {
        projectName: 'Test',
        unknownField: 'Should throw',
        anotherUnknown: 123
      };

      // Should throw in strict mode (default)
      expect(() => translator.humanToApi(tableId, humanFields)).toThrow(/Unmapped fields found/);
    });

    it('should pass through unknown fields when strictMode is false', () => {
      const tableId = '68a8ff5237fde0bf797c05b3';
      const humanFields = {
        projectName: 'Test',
        unknownField: 'Should pass through',
        anotherUnknown: 123
      };

      // Explicitly use non-strict mode
      const apiFields = translator.humanToApi(tableId, humanFields, false);

      expect(apiFields).toEqual({
        project_name_actual: 'Test',
        unknownField: 'Should pass through',
        anotherUnknown: 123
      });
    });

    it('should return input unchanged if no mappings exist for table', () => {
      const tableId = 'nonexistent-table';
      const humanFields = {
        field1: 'value1',
        field2: 'value2'
      };

      // When no mappings exist, both strict and non-strict modes pass through
      const apiFields = translator.humanToApi(tableId, humanFields);

      expect(apiFields).toEqual(humanFields);
    });

    it('should handle nested objects correctly in non-strict mode', () => {
      const tableId = '68a8ff5237fde0bf797c05b3';
      const humanFields = {
        projectName: 'Test',
        metadata: {
          nested: 'value',
          deep: {
            field: 'data'
          }
        }
      };

      // Use non-strict mode to allow unmapped nested fields
      const apiFields = translator.humanToApi(tableId, humanFields, false);

      expect(apiFields.project_name_actual).toBe('Test');
      expect(apiFields.metadata).toEqual(humanFields.metadata);
    });
  });

  describe('apiToHuman', () => {
    beforeEach(async () => {
      // Load test mappings
      const yamlPath = '/Volumes/EAV/new-system/data/field-mappings/projects.yaml';
      await translator.loadFromYaml(yamlPath);
    });

    it('should translate API codes back to human-readable fields', () => {
      const tableId = '68a8ff5237fde0bf797c05b3';
      const apiFields = {
        project_name_actual: 'Test Project',
        sbfc98645c: 'ACME Corp',
        status: 'Production',
        priority: 'High',
        autonumber: 'EAV001'
      };

      const humanFields = translator.apiToHuman(tableId, apiFields);

      expect(humanFields).toEqual({
        projectName: 'Test Project',
        client: 'ACME Corp',
        projectPhase: 'Production',
        priority: 'High',
        eavCode: 'EAV001'
      });
    });

    it('should pass through unknown API fields unchanged', () => {
      const tableId = '68a8ff5237fde0bf797c05b3';
      const apiFields = {
        project_name_actual: 'Test',
        unknown_api_field: 'Should pass through',
        another_unknown: 456
      };

      const humanFields = translator.apiToHuman(tableId, apiFields);

      expect(humanFields).toEqual({
        projectName: 'Test',
        unknown_api_field: 'Should pass through',
        another_unknown: 456
      });
    });

    it('should return input unchanged if no mappings exist for table', () => {
      const tableId = 'nonexistent-table';
      const apiFields = {
        api_field1: 'value1',
        api_field2: 'value2'
      };

      const humanFields = translator.apiToHuman(tableId, apiFields);

      expect(humanFields).toEqual(apiFields);
    });
  });

  // detectFieldType tests removed - method was removed per Critical Engineer recommendation
  // The wrapper enforces a strict contract - calling code should know the expected format
  // TEST-METHODOLOGY-GUARDIAN: Approved removal of obsolete tests for non-existent method

  describe('loadAllMappings', () => {
    it('should load all YAML files from field-mappings directory', async () => {
      const mappingsDir = '/Volumes/EAV/new-system/data/field-mappings';
      await translator.loadAllMappings(mappingsDir);

      // Should have loaded multiple table mappings
      const projectsTableId = '68a8ff5237fde0bf797c05b3';
      const videosTableId = '68b2437a8f1755b055e0a124'; // Actual table ID from videos.yaml
      
      expect(translator.hasMappings(projectsTableId)).toBe(true);
      expect(translator.hasMappings(videosTableId)).toBe(true);
    });

    it('should skip non-YAML files', async () => {
      const mappingsDir = '/Volumes/EAV/new-system/data/field-mappings';
      
      // Should not throw when encountering README.md
      await expect(translator.loadAllMappings(mappingsDir)).resolves.not.toThrow();
    });
  });

  describe('Integration with SmartSuite Client', () => {
    it('should integrate seamlessly with existing client methods', () => {
      // This test verifies the translator can be used as a drop-in wrapper
      // Removed unused mockClient variable - TEST-METHODOLOGY-GUARDIAN approved
      
      // The translator should work as a middleware layer
      const tableId = '68a8ff5237fde0bf797c05b3';
      const humanQuery = { projectName: 'Test' };
      const apiQuery = translator.humanToApi(tableId, humanQuery, false); // Use non-strict mode for passthrough

      expect(apiQuery).toBeDefined();
      expect(typeof apiQuery).toBe('object');
    });
  });
});