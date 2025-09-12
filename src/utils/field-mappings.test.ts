// TEST: failing tests for field mapping utility
// Context7: consulted for vitest
// Context7: consulted for fs
// Context7: consulted for path
// Context7: consulted for yaml

import { describe, it, expect, beforeEach } from 'vitest';

import { FieldMappingLoader } from './field-mappings.js';

describe('FieldMappingLoader', () => {
  beforeEach(() => {
    // Clear cache between tests
    FieldMappingLoader.clearCache();
  });

  describe('load', () => {
    it('should load field mappings for tasks table', () => {
      const mapping = FieldMappingLoader.load('tasks');

      expect(mapping).toHaveProperty('tableName', 'tasks');
      expect(mapping).toHaveProperty('tableId', '68c24591b7d2aad485e8f781');
      expect(mapping).toHaveProperty('fields');
      expect(mapping.fields).toHaveProperty('taskCode', 'task12code');
      expect(mapping.fields).toHaveProperty('project', 'projid1234');
      expect(mapping.fields).toHaveProperty('assignedTo', 'assigned_to');
    });

    it('should load field mappings for projects table', () => {
      const mapping = FieldMappingLoader.load('projects');

      expect(mapping).toHaveProperty('tableName', 'projects');
      expect(mapping).toHaveProperty('tableId', '68a8ff5237fde0bf797c05b3');
      expect(mapping).toHaveProperty('fields');
      expect(mapping.fields).toHaveProperty('dueDate', 'projdue456');
      expect(mapping.fields).toHaveProperty('eavCode', 'autonumber');
    });

    it('should throw error for non-existent table', () => {
      expect(() => {
        FieldMappingLoader.load('nonexistent');
      }).toThrow('Failed to load field mappings for nonexistent');
    });

    it('should cache loaded mappings', () => {
      const mapping1 = FieldMappingLoader.load('tasks');
      const mapping2 = FieldMappingLoader.load('tasks');

      expect(mapping1).toBe(mapping2); // Same reference = cached
    });
  });

  describe('getFieldName', () => {
    it('should return correct field name for tasks table', () => {
      const fieldName = FieldMappingLoader.getFieldName('tasks', 'taskCode');
      expect(fieldName).toBe('task12code');
    });

    it('should return correct field name for projects table', () => {
      const fieldName = FieldMappingLoader.getFieldName('projects', 'dueDate');
      expect(fieldName).toBe('projdue456');
    });

    it('should throw error for non-existent field', () => {
      expect(() => {
        FieldMappingLoader.getFieldName('tasks', 'nonexistentField');
      }).toThrow("Field 'nonexistentField' not found in tasks mapping");
    });
  });

  describe('getTableId', () => {
    it('should return correct table ID for tasks', () => {
      const tableId = FieldMappingLoader.getTableId('tasks');
      expect(tableId).toBe('68c24591b7d2aad485e8f781');
    });

    it('should return correct table ID for projects', () => {
      const tableId = FieldMappingLoader.getTableId('projects');
      expect(tableId).toBe('68a8ff5237fde0bf797c05b3');
    });
  });

  describe('clearCache', () => {
    it('should clear the internal cache', () => {
      // Load once to populate cache
      FieldMappingLoader.load('tasks');

      // Clear cache
      FieldMappingLoader.clearCache();

      // This should load from file again, not cache
      const mapping = FieldMappingLoader.load('tasks');
      expect(mapping).toHaveProperty('tableName', 'tasks');
    });
  });
});
