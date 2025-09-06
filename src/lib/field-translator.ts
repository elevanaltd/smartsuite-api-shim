// Context7: consulted for yaml
// Context7: consulted for fs-extra
// Context7: consulted for path
// Critical-Engineer: consulted for API shim architecture and field translation strategy
import * as path from 'path';

import fs from 'fs-extra';
import * as yaml from 'yaml';

export interface FieldMapping {
  tableName: string;
  tableId: string;
  solutionId?: string;
  fields: Record<string, string>;
  reverseMap?: Record<string, string>; // Pre-computed reverse mapping for performance
}

export class FieldTranslator {
  private mappings: Map<string, FieldMapping> = new Map();

  /**
   * Load field mappings from a YAML file
   * FAIL FAST: Throws errors instead of silent failure
   */
  async loadFromYaml(yamlPath: string): Promise<void> {
    try {
      const yamlContent = await fs.readFile(yamlPath, 'utf8');
      const mapping = yaml.parse(yamlContent) as FieldMapping;

      if (mapping.tableId && mapping.fields) {
        // Pre-compute reverse mapping for performance
        mapping.reverseMap = {};
        for (const [human, api] of Object.entries(mapping.fields)) {
          mapping.reverseMap[api] = human;
        }

        this.mappings.set(mapping.tableId, mapping);
      } else {
        throw new Error(`Invalid mapping structure in ${yamlPath}: missing tableId or fields`);
      }
    } catch (error) {
      console.error(`Failed to load YAML from ${yamlPath}:`, error);
      throw error; // FAIL FAST: Re-throw to prevent silent failures
    }
  }

  /**
   * Load all YAML mappings from a directory
   * FAIL FAST: Throws errors instead of silent failure
   */
  async loadAllMappings(mappingsDir: string): Promise<void> {
    try {
      const files = await fs.readdir(mappingsDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      if (yamlFiles.length === 0) {
        throw new Error(`No YAML mapping files found in directory: ${mappingsDir}`);
      }

      for (const file of yamlFiles) {
        const filePath = path.join(mappingsDir, file);
        await this.loadFromYaml(filePath);
      }
    } catch (error) {
      console.error(`Failed to load mappings from directory ${mappingsDir}:`, error);
      throw error; // FAIL FAST: Re-throw to prevent silent failures
    }
  }

  /**
   * Check if mappings exist for a table
   */
  hasMappings(tableId: string): boolean {
    return this.mappings.has(tableId);
  }

  /**
   * Translate human-readable field names to API field codes
   * STRICT MODE: Throws errors for unmapped fields when mapping exists
   */
  humanToApi(tableId: string, humanFields: Record<string, any>, strictMode: boolean = true): Record<string, any> {
    const mapping = this.mappings.get(tableId);
    if (!mapping) {
      return humanFields;
    }

    const result: Record<string, any> = {};
    const unmappedFields: string[] = [];

    for (const [key, value] of Object.entries(humanFields)) {
      // Check if this human field name has a mapping
      const apiField = mapping.fields[key];
      if (apiField) {
        result[apiField] = value;
      } else {
        if (strictMode) {
          unmappedFields.push(key);
        } else {
          // Pass through unmapped fields (legacy mode)
          result[key] = value;
        }
      }
    }

    // FAIL FAST: Enforce strict schema in default mode
    if (strictMode && unmappedFields.length > 0) {
      throw new Error(`Unmapped fields found for table ${tableId} (${mapping.tableName}): ${unmappedFields.join(', ')}. Available fields: ${Object.keys(mapping.fields).join(', ')}`);
    }

    return result;
  }

  /**
   * Translate API field codes to human-readable names
   * PERFORMANCE OPTIMIZED: Uses pre-computed reverse mapping
   */
  apiToHuman(tableId: string, apiFields: Record<string, any>): Record<string, any> {
    const mapping = this.mappings.get(tableId);
    if (!mapping?.reverseMap) {
      return apiFields;
    }

    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(apiFields)) {
      // Use pre-computed reverse mapping for performance
      const humanField = mapping.reverseMap[key];
      if (humanField) {
        result[humanField] = value;
      } else {
        // Pass through unmapped fields
        result[key] = value;
      }
    }

    return result;
  }

  // REMOVED: detectFieldType method per Critical Engineer recommendation
  // The wrapper enforces a strict contract - calling code should know the expected format
  // Heuristic detection creates brittleness and ambiguity
}
