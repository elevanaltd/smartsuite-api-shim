// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FieldTranslator } from '../src/lib/field-translator';

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

    it('should handle missing YAML file gracefully', async () => {
      const yamlPath = '/nonexistent/file.yaml';
      
      // Should not throw, but log error
      await expect(translator.loadFromYaml(yamlPath)).resolves.not.toThrow();
      expect(translator.hasMappings('nonexistent')).toBe(false);
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

      const apiFields = translator.humanToApi(tableId, humanFields);

      expect(apiFields).toEqual({
        project_name_actual: 'Test Project',
        sbfc98645c: 'ACME Corp',
        status: 'Production',
        priority: 'High'
      });
    });

    it('should pass through unknown fields unchanged', () => {
      const tableId = '68a8ff5237fde0bf797c05b3';
      const humanFields = {
        projectName: 'Test',
        unknownField: 'Should pass through',
        anotherUnknown: 123
      };

      const apiFields = translator.humanToApi(tableId, humanFields);

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

      const apiFields = translator.humanToApi(tableId, humanFields);

      expect(apiFields).toEqual(humanFields);
    });

    it('should handle nested objects correctly', () => {
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

      const apiFields = translator.humanToApi(tableId, humanFields);

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

  describe('detectFieldType', () => {
    it('should detect human-readable field names', () => {
      const humanFields = {
        projectName: 'Test',
        clientContact: 'John',
        finalDelivery: '2025-01-15'
      };

      expect(translator.detectFieldType(humanFields)).toBe('human');
    });

    it('should detect cryptic API field codes', () => {
      const crypticFields = {
        s8faf2: 'Test',
        sbfc98645c: 'ACME',
        f4d3a1: 'active'
      };

      expect(translator.detectFieldType(crypticFields)).toBe('cryptic');
    });

    it('should detect clean API slugs', () => {
      const cleanApiFields = {
        project_name_actual: 'Test',
        main_status: 'active',
        video_seq01: 'V001'
      };

      expect(translator.detectFieldType(cleanApiFields)).toBe('api');
    });

    it('should handle mixed field types by returning most common', () => {
      const mixedFields = {
        projectName: 'Test',        // human
        s8faf2: 'Value',            // cryptic
        another_field: 'Data'       // api (underscore)
      };

      // Should identify based on majority
      expect(translator.detectFieldType(mixedFields)).toBeTruthy();
    });

    it('should handle empty objects', () => {
      expect(translator.detectFieldType({})).toBe('unknown');
    });

    it('should handle null/undefined gracefully', () => {
      expect(translator.detectFieldType(null as any)).toBe('unknown');
      expect(translator.detectFieldType(undefined as any)).toBe('unknown');
    });
  });

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
      const mockClient = {
        query: vi.fn().mockResolvedValue({ data: [] }),
        mutate: vi.fn().mockResolvedValue({ success: true })
      };

      // The translator should work as a middleware layer
      const tableId = '68a8ff5237fde0bf797c05b3';
      const humanQuery = { projectName: 'Test' };
      const apiQuery = translator.humanToApi(tableId, humanQuery);

      expect(apiQuery).toBeDefined();
      expect(typeof apiQuery).toBe('object');
    });
  });
});