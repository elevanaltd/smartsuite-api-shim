// Field mapping utility for SmartSuite table configurations
// Loads YAML field mappings from config directory
// Context7: consulted for fs
// Context7: consulted for path
// Context7: consulted for yaml

import { readFileSync } from 'fs';
import { join } from 'path';

import { parse } from 'yaml';

export interface FieldMapping {
  tableName: string;
  tableId: string;
  solutionId: string;
  tableSlug?: string;
  fields: Record<string, string>;
  [key: string]: unknown; // For additional config like options
}

export class FieldMappingLoader {
  private static cache = new Map<string, FieldMapping>();

  /**
   * Load field mappings for a specific table
   * @param tableName - Name of the table (e.g., 'tasks', 'projects')
   * @returns Field mapping configuration
   */
  static load(tableName: string): FieldMapping {
    // Check cache first
    if (this.cache.has(tableName)) {
      return this.cache.get(tableName)!;
    }

    try {
      // Load from config directory
      const configPath = join(process.cwd(), 'config', 'field-mappings', 'examples', `${tableName}.yaml`);
      const yamlContent = readFileSync(configPath, 'utf8');
      const mapping = parse(yamlContent) as FieldMapping;

      // Validate required fields
      if (!mapping.tableId || !mapping.fields) {
        throw new Error(`Invalid field mapping config for ${tableName}: missing tableId or fields`);
      }

      // Cache the result
      this.cache.set(tableName, mapping);

      return mapping;
    } catch (error) {
      throw new Error(`Failed to load field mappings for ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the SmartSuite field name for a human-readable field name
   * @param tableName - Table name
   * @param humanFieldName - Human-readable field name
   * @returns SmartSuite API field name
   */
  static getFieldName(tableName: string, humanFieldName: string): string {
    const mapping = this.load(tableName);
    const fieldName = mapping.fields[humanFieldName];

    if (!fieldName) {
      throw new Error(`Field '${humanFieldName}' not found in ${tableName} mapping`);
    }

    return fieldName;
  }

  /**
   * Get table ID from field mappings
   * @param tableName - Table name
   * @returns SmartSuite table ID
   */
  static getTableId(tableName: string): string {
    const mapping = this.load(tableName);
    return mapping.tableId;
  }

  /**
   * Clear cache (useful for testing or config reloading)
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
