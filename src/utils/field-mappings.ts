// Field mapping utility for SmartSuite table configurations
// Loads YAML field mappings from config directory
// Context7: consulted for fs
// Context7: consulted for path
// Context7: consulted for yaml
// Context7: consulted for url
// ERROR-ARCHITECT: Fixed path resolution for absolute paths

import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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
   * Get the absolute path to the project root
   * Works regardless of where the MCP server is executed from
   */
  private static getProjectRoot(): string {
    // For ES modules, use import.meta.url to get current file path
    // For CommonJS compatibility, fallback to __dirname approach
    try {
      const currentFileUrl = import.meta.url || `file://${__filename}`;
      const currentDir = dirname(fileURLToPath(currentFileUrl));
      // Navigate up from src/utils/ to project root
      return resolve(currentDir, '..', '..');
    } catch {
      // Fallback to process.cwd() if module resolution fails
      return process.cwd();
    }
  }

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
      const projectRoot = this.getProjectRoot();

      // Priority order for config locations:
      // 1. Production config (preferred)
      // 2. Examples directory (fallback for development)
      const configPaths = [
        join(projectRoot, 'config', 'field-mappings', `${tableName}.yaml`),
        join(projectRoot, 'config', 'field-mappings', 'examples', `${tableName}.yaml`),
      ];

      let configPath: string | null = null;
      let yamlContent: string | null = null;

      // Find the first existing config file
      for (const path of configPaths) {
        if (existsSync(path)) {
          configPath = path;
          yamlContent = readFileSync(path, 'utf8');
          break;
        }
      }

      if (!yamlContent || !configPath) {
        throw new Error(
          `Field mapping config not found for ${tableName}. Searched paths:\n` +
          configPaths.map(p => `  - ${p}`).join('\n'),
        );
      }

      const mapping = parse(yamlContent) as FieldMapping;

      // Validate required fields
      if (!mapping.tableId || !mapping.fields) {
        throw new Error(`Invalid field mapping config for ${tableName}: missing tableId or fields`);
      }

      // Cache the result
      this.cache.set(tableName, mapping);

      console.log(`Loaded field mapping for ${tableName} from: ${configPath}`);

      return mapping;
    } catch (error) {
      // Provide detailed error with paths checked
      if (error instanceof Error && error.message.includes('not found')) {
        throw error; // Re-throw our custom error with paths
      }
      throw new Error(
        `Failed to load field mappings for ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
