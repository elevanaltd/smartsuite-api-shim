// Context7: consulted for yaml
// Context7: consulted for fs-extra
// Context7: consulted for path
import * as yaml from 'yaml';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface FieldMapping {
  tableName: string;
  tableId: string;
  solutionId?: string;
  fields: Record<string, string>;
}

export class FieldTranslator {
  private mappings: Map<string, FieldMapping> = new Map();

  /**
   * Load field mappings from a YAML file
   */
  async loadFromYaml(yamlPath: string): Promise<void> {
    try {
      const yamlContent = await fs.readFile(yamlPath, 'utf8');
      const mapping = yaml.parse(yamlContent) as FieldMapping;
      
      if (mapping.tableId) {
        this.mappings.set(mapping.tableId, mapping);
      }
    } catch (error) {
      console.error(`Failed to load YAML from ${yamlPath}:`, error);
    }
  }

  /**
   * Load all YAML mappings from a directory
   */
  async loadAllMappings(mappingsDir: string): Promise<void> {
    try {
      const files = await fs.readdir(mappingsDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      
      for (const file of yamlFiles) {
        const filePath = path.join(mappingsDir, file);
        await this.loadFromYaml(filePath);
      }
    } catch (error) {
      console.error(`Failed to load mappings from directory ${mappingsDir}:`, error);
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
   */
  humanToApi(tableId: string, humanFields: Record<string, any>): Record<string, any> {
    const mapping = this.mappings.get(tableId);
    if (!mapping) {
      return humanFields;
    }

    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(humanFields)) {
      // Check if this human field name has a mapping
      const apiField = mapping.fields[key];
      if (apiField) {
        result[apiField] = value;
      } else {
        // Pass through unmapped fields
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Translate API field codes to human-readable names
   */
  apiToHuman(tableId: string, apiFields: Record<string, any>): Record<string, any> {
    const mapping = this.mappings.get(tableId);
    if (!mapping) {
      return apiFields;
    }

    // Create reverse mapping
    const reverseMap: Record<string, string> = {};
    for (const [human, api] of Object.entries(mapping.fields)) {
      reverseMap[api] = human;
    }

    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(apiFields)) {
      // Check if this API field has a human mapping
      const humanField = reverseMap[key];
      if (humanField) {
        result[humanField] = value;
      } else {
        // Pass through unmapped fields
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Detect whether fields are human-readable, API codes, or cryptic
   */
  detectFieldType(fields: Record<string, any>): 'human' | 'api' | 'cryptic' | 'unknown' {
    if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
      return 'unknown';
    }

    const fieldNames = Object.keys(fields);
    let humanCount = 0;
    let apiCount = 0;
    let crypticCount = 0;

    for (const field of fieldNames) {
      // Cryptic fields: start with 's' followed by alphanumeric (e.g., sbfc98645c, s8faf2)
      if (/^s[a-f0-9]{5,}/.test(field)) {
        crypticCount++;
      }
      // API fields: contain underscores (e.g., project_name_actual)
      else if (field.includes('_')) {
        apiCount++;
      }
      // Human fields: camelCase or simple words
      else if (/^[a-z][a-zA-Z0-9]*$/.test(field)) {
        humanCount++;
      }
    }

    // Return the type with the most matches
    if (crypticCount > humanCount && crypticCount > apiCount) {
      return 'cryptic';
    } else if (apiCount > humanCount && apiCount > crypticCount) {
      return 'api';
    } else if (humanCount > 0) {
      return 'human';
    }
    
    return 'unknown';
  }
}
