// TESTGUARD_BYPASS: TDD-GREEN-001 - Minimal implementation to pass failing test committed in 8272d0f
// Context7: consulted for @modelcontextprotocol/sdk (will be added when needed)
// Context7: consulted for zod
// Context7: consulted for winston
// Context7: consulted for path
// Context7: consulted for url
// Context7: consulted for fs-extra
// Critical-Engineer: consulted for Architecture pattern selection
// Critical-Engineer: consulted for Architecture and Security Validation
// Critical-Engineer: consulted for Architecture pattern selection
// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250905-fba0d14b
import * as path from 'path';
import { fileURLToPath } from 'url';

import { FieldTranslator } from './lib/field-translator.js';
import { SmartSuiteClient, SmartSuiteClientConfig, createAuthenticatedClient } from './smartsuite-client.js';

// Safe type conversion for lint cleanup - preserves runtime behavior
function toListOptions(options: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  // LINT_CLEANUP: Conservative conversion maintains existing behavior
  // TODO: Future enhancement - add Zod schema validation per Critical-Engineer recommendation
  return options;
}

export class SmartSuiteShimServer {
  private client?: SmartSuiteClient;
  private fieldTranslator: FieldTranslator;
  private fieldMappingsInitialized = false;
  private authConfig?: SmartSuiteClientConfig;
  private autoAuthPromise?: Promise<void>;

  constructor() {
    // Minimal implementation to make instantiation test pass
    this.fieldTranslator = new FieldTranslator();

    // AUTO-AUTHENTICATION: Check for environment variables and prepare auto-authentication
    this.tryAutoAuthentication();
  }

  /**
   * Check if server is authenticated (has valid client or pending auto-auth)
   */
  isAuthenticated(): boolean {
    return this.client !== undefined || this.hasValidEnvironmentConfig();
  }

  /**
   * Check if environment has valid auth configuration
   */
  private hasValidEnvironmentConfig(): boolean {
    const apiToken = process.env.SMARTSUITE_API_TOKEN;
    const workspaceId = process.env.SMARTSUITE_WORKSPACE_ID;
    return !!(apiToken && workspaceId);
  }

  /**
   * Get current authentication configuration
   */
  getAuthConfig(): SmartSuiteClientConfig | undefined {
    return this.authConfig;
  }

  /**
   * Attempt to auto-authenticate from environment variables
   */
  private tryAutoAuthentication(): void {
    const apiToken = process.env.SMARTSUITE_API_TOKEN;
    const workspaceId = process.env.SMARTSUITE_WORKSPACE_ID;

    if (apiToken && workspaceId) {
      this.authConfig = {
        apiKey: apiToken,
        workspaceId: workspaceId,
      };

      // Start auto-authentication but don't block constructor
      this.autoAuthPromise = this.authenticate(this.authConfig).catch(error => {
        console.warn('Auto-authentication failed:', error.message);
        // Clear client on failure but keep config for priority testing
        delete this.client;
        throw error; // Re-throw to keep promise rejected
      });
    }
  }

  /**
   * Ensure authentication is complete before tool execution
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.client) {
      return; // Already authenticated
    }

    if (this.autoAuthPromise) {
      // Wait for auto-authentication to complete
      try {
        await this.autoAuthPromise;
      } catch (error) {
        // Auto-auth failed, throw original auth error
        throw new Error('Authentication required: call authenticate() first');
      }
    } else if (!this.client) {
      throw new Error('Authentication required: call authenticate() first');
    }
  }

  getTools(): Array<{name: string; description?: string; inputSchema: {type: string; properties: Record<string, unknown>; required?: string[]}}> {
    // Return tools in MCP protocol-compliant format with proper schemas
    return [
      {
        name: 'smartsuite_query',
        description: 'Query SmartSuite records with filtering, sorting, and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['list', 'get', 'search', 'count'],
              description: 'The query operation to perform',
            },
            appId: {
              type: 'string',
              description: 'SmartSuite application ID (24-char hex)',
            },
            recordId: {
              type: 'string',
              description: 'Record ID (required for get operation)',
            },
            filters: {
              type: 'object',
              description: 'Filtering criteria',
            },
            sort: {
              type: 'object',
              description: 'Sorting configuration',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of records to return',
            },
          },
          required: ['operation', 'appId'],
        },
      },
      {
        name: 'smartsuite_record',
        description: 'Create, update, or delete SmartSuite records with DRY-RUN safety',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['create', 'update', 'delete', 'bulk_update', 'bulk_delete'],
              description: 'The record operation to perform',
            },
            appId: {
              type: 'string',
              description: 'SmartSuite application ID (24-char hex)',
            },
            recordId: {
              type: 'string',
              description: 'Record ID (required for update/delete)',
            },
            data: {
              type: 'object',
              description: 'Record data for create/update operations',
            },
            dry_run: {
              type: 'boolean',
              default: true,
              description: 'Preview changes without executing (safety default)',
            },
          },
          required: ['operation', 'appId'],
        },
      },
      {
        name: 'smartsuite_schema',
        description: 'Get SmartSuite application schema and field definitions',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'SmartSuite application ID (24-char hex)',
            },
          },
          required: ['appId'],
        },
      },
      {
        name: 'smartsuite_undo',
        description: 'Undo a previous SmartSuite operation using transaction history',
        inputSchema: {
          type: 'object',
          properties: {
            transaction_id: {
              type: 'string',
              description: 'Transaction ID from a previous operation',
            },
          },
          required: ['transaction_id'],
        },
      },
    ];
  }

  /**
   * Initialize field mappings from config directory
   * CRITICAL: This enables human-readable field names per North Star
   */
  private async initializeFieldMappings(): Promise<void> {
    try {
      // Get the directory path relative to the compiled JS location
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Multiple path resolution strategies for different environments
      const possiblePaths = [
        // Production: from build/src/mcp-server.js -> ../../config/field-mappings
        path.resolve(__dirname, '../../config/field-mappings'),
        // Development: from src/mcp-server.js -> ../config/field-mappings
        path.resolve(__dirname, '../config/field-mappings'),
        // Test environment: from process.cwd()
        path.resolve(process.cwd(), 'config/field-mappings'),
        // Absolute fallback for dev environment
        '/Volumes/HestAI-Projects/smartsuite-api-shim/dev/config/field-mappings',
      ];

      let configPath: string | null = null;

      // Try each path until we find one that exists
      for (const tryPath of possiblePaths) {
        try {
          // Use fs-extra to check if directory exists and has files
          const fs = await import('fs-extra');
          if (await fs.pathExists(tryPath)) {
            const files = await fs.readdir(tryPath);
            if (files.some(f => f.endsWith('.yaml') || f.endsWith('.yml'))) {
              configPath = tryPath;
              break;
            }
          }
        } catch {
          // Continue to next path
        }
      }

      if (!configPath) {
        throw new Error('No valid field mappings directory found');
      }

      console.log('Loading field mappings from:', configPath);
      await this.fieldTranslator.loadAllMappings(configPath);
      console.log('FieldTranslator initialized successfully with', this.fieldTranslator['mappings'].size, 'mappings');
    } catch (error) {
      console.error('Failed to initialize field mappings:', error);
      // GRACEFUL DEGRADATION: Don't fail startup if field mappings are missing
      // This allows the server to work with raw API codes as fallback
      console.warn('Field mappings not available - server will use raw API field codes');
    }
  }

  async authenticate(config: SmartSuiteClientConfig): Promise<void> {
    // Initialize field mappings on first use (lazy loading)
    if (!this.fieldMappingsInitialized) {
      await this.initializeFieldMappings();
      this.fieldMappingsInitialized = true;
    }

    // ENVIRONMENT VARIABLE PRIORITY: If env vars are set, use them instead of provided config
    let effectiveConfig = config;
    const envToken = process.env.SMARTSUITE_API_TOKEN;
    const envWorkspaceId = process.env.SMARTSUITE_WORKSPACE_ID;

    if (envToken && envWorkspaceId) {
      effectiveConfig = {
        apiKey: envToken,
        workspaceId: envWorkspaceId,
        baseUrl: config.baseUrl || 'https://app.smartsuite.com/api/v1', // Provide default if undefined
      };
      // Update stored config to reflect environment priority
      this.authConfig = effectiveConfig;
    } else {
      // Store manual config when env vars not present
      this.authConfig = config;
    }

    // SIMPLE scope: Basic authentication with client storage
    this.client = await createAuthenticatedClient(effectiveConfig);
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // AUTO-AUTHENTICATION: Ensure authentication is complete
    await this.ensureAuthenticated();

    // Initialize field mappings on first use if not already done
    if (!this.fieldMappingsInitialized) {
      await this.initializeFieldMappings();
      this.fieldMappingsInitialized = true;
    }

    // DRY-RUN pattern enforcement for mutations (North Star requirement)
    if (toolName === 'smartsuite_record' && !(args.dry_run as boolean)) {
      throw new Error('Dry-run pattern required: mutation tools must specify dry_run parameter');
    }

    // Basic tool dispatch
    switch (toolName) {
      case 'smartsuite_query':
        return this.handleQuery(args);
      case 'smartsuite_record':
        return this.handleRecord(args);
      case 'smartsuite_schema':
        return this.handleSchema(args);
      case 'smartsuite_undo':
        return this.handleUndo(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async handleQuery(args: Record<string, unknown>): Promise<unknown> {
    // FIELD TRANSLATION: Convert human-readable field names to API codes
    const operation = args.operation as string;
    const appId = args.appId as string;
    const recordId = args.recordId as string;
    const filters = args.filters as Record<string, unknown> | undefined;
    const sort = args.sort as Record<string, unknown> | undefined;
    const limit = args.limit as number | undefined;

    // Translate filters and sort options if field mappings exist
    const translatedFilters = filters && this.fieldTranslator.hasMappings(appId)
      ? this.fieldTranslator.humanToApi(appId, filters, false) // Non-strict mode for filters
      : filters;

    const translatedSort = sort && this.fieldTranslator.hasMappings(appId)
      ? this.fieldTranslator.humanToApi(appId, sort, false) // Non-strict mode for sort
      : sort;

    const options = {
      ...(translatedFilters && { filter: translatedFilters }),
      ...(translatedSort && { sort: translatedSort }),
      ...(limit && { limit }),
    };

    let result: unknown;
    switch (operation) {
      case 'list':
        result = await this.client!.listRecords(appId, toListOptions(options));
        break;
      case 'get':
        result = await this.client!.getRecord(appId, recordId);
        break;
      case 'search':
        // SIMPLE scope: search is just list with filter
        result = await this.client!.listRecords(appId, toListOptions(options));
        break;
      case 'count': {
        const records = await this.client!.listRecords(appId, toListOptions(options));
        result = { count: records.length };
        break;
      }
      default:
        throw new Error(`Unknown query operation: ${operation}`);
    }

    // FIELD TRANSLATION: Convert API response back to human-readable names
    if (this.fieldTranslator.hasMappings(appId) && result && typeof result === 'object') {
      if (Array.isArray(result)) {
        // Handle array of records (list/search results)
        return result.map(record =>
          typeof record === 'object' && record !== null
            ? this.fieldTranslator.apiToHuman(appId, record as Record<string, unknown>)
            : record,
        );
      } else if ('count' in (result as Record<string, unknown>)) {
        // Handle count result - no field translation needed
        return result;
      } else {
        // Handle single record (get result)
        return this.fieldTranslator.apiToHuman(appId, result as Record<string, unknown>);
      }
    }

    return result;
  }

  private async handleRecord(args: Record<string, unknown>): Promise<unknown> {
    // FIELD TRANSLATION: Convert human-readable field names to API codes
    const operation = args.operation as string;
    const appId = args.appId as string;
    const recordId = args.recordId as string;
    const inputData = args.data as Record<string, unknown>;
    const dry_run = args.dry_run as boolean;

    // Check for unimplemented operations FIRST (before dry-run)
    // This ensures we don't claim we can preview operations that don't exist
    if (operation === 'bulk_update' || operation === 'bulk_delete') {
      throw new Error(`Bulk operations not yet implemented: ${operation}`);
    }

    // Translate field names if mappings exist and data is provided
    const translatedData = inputData && this.fieldTranslator.hasMappings(appId)
      ? this.fieldTranslator.humanToApi(appId, inputData, true) // Strict mode for data
      : inputData;

    if (dry_run) {
      return {
        dry_run: true,
        operation,
        appId,
        recordId,
        originalData: inputData,
        translatedData,
        fieldMappingsUsed: this.fieldTranslator.hasMappings(appId),
        message: `DRY-RUN: Would execute ${operation} operation${this.fieldTranslator.hasMappings(appId) ? ' with field translation' : ''}`,
      };
    }

    let result: unknown;
    switch (operation) {
      case 'create':
        result = await this.client!.createRecord(appId, translatedData);
        break;
      case 'update':
        result = await this.client!.updateRecord(appId, recordId, translatedData);
        break;
      case 'delete':
        await this.client!.deleteRecord(appId, recordId);
        result = { deleted: recordId };
        break;
      default:
        throw new Error(`Unknown record operation: ${String(operation)}`);
    }

    // FIELD TRANSLATION: Convert API response back to human-readable names
    if (this.fieldTranslator.hasMappings(appId) && result && typeof result === 'object' && !('deleted' in (result as Record<string, unknown>))) {
      return this.fieldTranslator.apiToHuman(appId, result as Record<string, unknown>);
    }

    return result;
  }

  private async handleSchema(args: Record<string, unknown>): Promise<unknown> {
    // ENHANCED scope: Schema operations with field mappings
    const appId = args.appId as string;
    const schema = await this.client!.getSchema(appId);

    // FIELD MAPPING: Add human-readable field mappings to schema response
    if (this.fieldTranslator.hasMappings(appId)) {
      return {
        ...schema,
        fieldMappings: {
          hasCustomMappings: true,
          message: 'This table supports human-readable field names. Use field names from the mappings below instead of API codes.',
          // Note: We don't expose internal mapping structure for security
          // Users should refer to documentation for available field names
        },
      };
    }

    return {
      ...schema,
      fieldMappings: {
        hasCustomMappings: false,
        message: 'This table uses raw API field codes. Custom field mappings not available.',
      },
    };
  }

  private handleUndo(_args: Record<string, unknown>): Promise<unknown> {
    // SIMPLE scope: Undo placeholder
    throw new Error('Undo functionality not yet implemented');
  }
}
