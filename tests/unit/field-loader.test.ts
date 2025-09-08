// Context7: consulted for vitest
// Context7: consulted for fs-extra  
// Context7: consulted for path
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EnhancedFieldLoader } from '../../src/field-loader';

describe('EnhancedFieldLoader', () => {
  const testBaseDir = '/tmp/test-field-mappings';
  let loader: EnhancedFieldLoader;

  beforeEach(async () => {
    loader = new EnhancedFieldLoader();
    // Clean up and create test directory structure
    await fs.ensureDir(testBaseDir);
    await fs.ensureDir(path.join(testBaseDir, 'examples'));
    await fs.ensureDir(path.join(testBaseDir, 'defaults'));
  });

  afterEach(async () => {
    // Clean up test directories
    await fs.remove(testBaseDir);
  });

  describe('loadMappingsWithFallback', () => {
    it('should prioritize local mappings when available', async () => {
      // Arrange - create local mapping
      const localMapping = {
        's5cf4d4f': 'client_name',
        's5cf4d50': 'client_email',
      };
      await fs.writeFile(
        path.join(testBaseDir, 'clients.yaml'),
        `s5cf4d4f: client_name\ns5cf4d50: client_email`
      );

      // Act
      const result = await loader.loadMappingsWithFallback(testBaseDir);

      // Assert
      expect(result.source).toBe('local');
      expect(result.warnings).toHaveLength(0);
      expect(result.mappings.get('clients')).toEqual(localMapping);
    });

    it('should fall back to examples when no local mappings exist', async () => {
      // Arrange - create example mapping
      const exampleMapping = {
        's5cf4d4f': 'example_name',
        's5cf4d50': 'example_email',
      };
      await fs.writeFile(
        path.join(testBaseDir, 'examples', 'clients.example.yaml'),
        `s5cf4d4f: example_name\ns5cf4d50: example_email`
      );

      // Act
      const result = await loader.loadMappingsWithFallback(testBaseDir);

      // Assert
      expect(result.source).toBe('example');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('No local field mappings found');
      expect(result.mappings.get('clients')).toEqual(exampleMapping);
    });

    it('should merge defaults with examples when both exist', async () => {
      // Arrange
      const exampleMapping = {
        's5cf4d4f': 'example_name',
      };
      const defaultMapping = {
        'default_field': 'default_value',
      };
      
      await fs.writeFile(
        path.join(testBaseDir, 'examples', 'clients.example.yaml'),
        `s5cf4d4f: example_name`
      );
      await fs.writeFile(
        path.join(testBaseDir, 'defaults', 'common.yaml'),
        `default_field: default_value`
      );

      // Act
      const result = await loader.loadMappingsWithFallback(testBaseDir);

      // Assert
      expect(result.source).toBe('example');
      expect(result.mappings.get('clients')).toEqual(exampleMapping);
      expect(result.mappings.get('common')).toEqual(defaultMapping);
    });

    it('should use defaults only when no local or examples exist', async () => {
      // Arrange - create default mapping only
      const defaultMapping = {
        'default_field': 'default_value',
      };
      await fs.writeFile(
        path.join(testBaseDir, 'defaults', 'common.yaml'),
        `default_field: default_value`
      );

      // Act
      const result = await loader.loadMappingsWithFallback(testBaseDir);

      // Assert
      expect(result.source).toBe('default');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Using default field mappings only');
      expect(result.mappings.get('common')).toEqual(defaultMapping);
    });

    it('should return warnings when no mappings found anywhere', async () => {
      // Act - no files created, empty directories
      const result = await loader.loadMappingsWithFallback(testBaseDir);

      // Assert
      expect(result.source).toBe('none');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('No field mappings found');
      expect(result.mappings.size).toBe(0);
    });

    it('should handle malformed YAML gracefully', async () => {
      // Arrange - create invalid YAML
      await fs.writeFile(
        path.join(testBaseDir, 'invalid.yaml'),
        `{invalid yaml content: [}`
      );

      // Act
      const result = await loader.loadMappingsWithFallback(testBaseDir);

      // Assert - should continue without crashing
      expect(result.source).toBe('none'); // No valid mappings loaded
      expect(result.mappings.size).toBe(0);
    });

    it('should track source paths for loaded mappings', async () => {
      // Arrange
      await fs.writeFile(
        path.join(testBaseDir, 'clients.yaml'),
        `s5cf4d4f: client_name`
      );

      // Act
      await loader.loadMappingsWithFallback(testBaseDir);
      const sourcePath = loader.getSourcePath('clients');

      // Assert
      expect(sourcePath).toBe(path.join(testBaseDir, 'clients.yaml'));
    });

    it('should handle multiple local mappings', async () => {
      // Arrange - create multiple local mappings
      const clientMapping = { 's5cf4d4f': 'client_name' };
      const projectMapping = { 'p_field1': 'project_name' };
      
      await fs.writeFile(
        path.join(testBaseDir, 'clients.yaml'),
        `s5cf4d4f: client_name`
      );
      await fs.writeFile(
        path.join(testBaseDir, 'projects.yaml'),
        `p_field1: project_name`
      );

      // Act
      const result = await loader.loadMappingsWithFallback(testBaseDir);

      // Assert
      expect(result.source).toBe('local');
      expect(result.mappings.size).toBe(2);
      expect(result.mappings.get('clients')).toEqual(clientMapping);
      expect(result.mappings.get('projects')).toEqual(projectMapping);
    });
  });

  describe('getMappings', () => {
    it('should return all loaded mappings', async () => {
      // Arrange
      await fs.writeFile(
        path.join(testBaseDir, 'test.yaml'),
        `field1: value1`
      );
      await loader.loadMappingsWithFallback(testBaseDir);

      // Act
      const mappings = loader.getMappings();

      // Assert
      expect(mappings).toBeInstanceOf(Map);
      expect(mappings.size).toBe(1);
      expect(mappings.has('test')).toBe(true);
    });
  });
});