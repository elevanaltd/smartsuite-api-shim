// MappingService: Centralized collision detection and mapping management
// TECHNICAL-ARCHITECT-APPROVED: TECHNICAL-ARCHITECT-20250909-9a54fa8a
// Critical-Engineer: consulted for collision detection architecture
// Context7: consulted for path
// Context7: consulted for fs-extra
// Context7: consulted for yaml
import * as path from 'path';
import fs from 'fs-extra';
import * as yaml from 'yaml';
import { TableResolver } from './table-resolver.js';
import { FieldTranslator } from './field-translator.js';

interface MappingStats {
  tablesLoaded: number;
  totalFields: number;
  tables: string[];
}

/**
 * MappingService provides centralized loading with collision detection
 * Ensures no duplicate table or field names before populating translators
 * FAIL FAST: All-or-nothing loading - validation happens before population
 */
export class MappingService {
  private tableResolver: TableResolver;
  private fieldTranslator: FieldTranslator;
  private loadedTables: Set<string> = new Set();
  private fieldCount: number = 0;

  constructor() {
    this.tableResolver = new TableResolver();
    this.fieldTranslator = new FieldTranslator();
  }

  /**
   * Load all mappings from directory with comprehensive collision detection
   * ATOMIC: Either all mappings load successfully or none do
   */
  async loadAllMappings(mappingsDir: string): Promise<void> {
    try {
      if (!await fs.pathExists(mappingsDir)) {
        throw new Error(`Directory does not exist: ${mappingsDir}`);
      }

      const files = await fs.readdir(mappingsDir);
      const yamlFiles = files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

      if (yamlFiles.length === 0) {
        throw new Error(`No YAML mapping files found in directory: ${mappingsDir}`);
      }

      // First pass: validate all files before loading
      const validatedMappings: Array<{file: string, content: any}> = [];
      const tableNames: Map<string, string> = new Map(); // normalized name -> file
      
      for (const file of yamlFiles) {
        const filePath = path.join(mappingsDir, file);
        const yamlContent = await fs.readFile(filePath, 'utf8');
        const mapping = yaml.parse(yamlContent) as any;

        // Validate table ID format
        if (mapping.tableId && !/^[a-f0-9]{24}$/i.test(mapping.tableId)) {
          throw new Error(`Invalid table ID '${mapping.tableId}' in ${file} - must be 24-char hex`);
        }

        // Check for table name collision
        if (mapping.tableName) {
          const normalized = mapping.tableName.toLowerCase();
          if (tableNames.has(normalized)) {
            throw new Error(
              `Configuration Error: Duplicate table name '${mapping.tableName}' detected. ` +
              `Already defined in ${tableNames.get(normalized)}. ` +
              `Cannot load from ${file}`
            );
          }
          tableNames.set(normalized, file);
        }

        // Check for field name collisions within this table
        if (mapping.fields) {
          const fieldNames: Map<string, string> = new Map(); // normalized -> original
          for (const fieldName of Object.keys(mapping.fields)) {
            const normalized = fieldName.toLowerCase();
            if (fieldNames.has(normalized)) {
              throw new Error(
                `Configuration Error: Duplicate field name detected in ${file}. ` +
                `Field '${fieldName}' collides with '${fieldNames.get(normalized)}' ` +
                `(both normalize to '${normalized}')`
              );
            }
            fieldNames.set(normalized, fieldName);
          }
        }

        validatedMappings.push({ file, content: mapping });
      }

      // Second pass: load validated mappings
      for (const { file, content } of validatedMappings) {
        const filePath = path.join(mappingsDir, file);
        
        // Load into TableResolver
        if (content.tableId && content.tableName) {
          await this.tableResolver.loadFromYaml(filePath);
          this.loadedTables.add(content.tableName);
        }

        // Load into FieldTranslator
        if (content.tableId && content.fields) {
          await this.fieldTranslator.loadFromYaml(filePath);
          this.fieldCount += Object.keys(content.fields).length;
        }
      }

    } catch (error) {
      // Reset on failure - atomic loading
      this.tableResolver = new TableResolver();
      this.fieldTranslator = new FieldTranslator();
      this.loadedTables.clear();
      this.fieldCount = 0;

      const errorMessage = `Failed to load mappings: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Get the TableResolver instance
   */
  getTableResolver(): TableResolver {
    return this.tableResolver;
  }

  /**
   * Get the FieldTranslator instance
   */
  getFieldTranslator(): FieldTranslator {
    return this.fieldTranslator;
  }

  /**
   * Get statistics about loaded mappings
   */
  getMappingStats(): MappingStats {
    return {
      tablesLoaded: this.loadedTables.size,
      totalFields: this.fieldCount,
      tables: Array.from(this.loadedTables)
    };
  }
}