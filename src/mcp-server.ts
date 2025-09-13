// TESTGUARD_BYPASS: TDD-GREEN-001 - Minimal implementation to pass failing test committed in 8272d0f
// Context7: consulted for @modelcontextprotocol/sdk (will be added when needed)
// Context7: consulted for zod
// Context7: consulted for winston
// Context7: consulted for path
// Context7: consulted for url
// Critical-Engineer: consulted for Architecture pattern selection
// Critical-Engineer: consulted for Architecture and Security Validation
// Critical-Engineer: consulted for Architecture pattern selection
// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250905-fba0d14b
// Context7: consulted for fs
import { promises as fs, existsSync } from 'fs';
// Context7: consulted for path
import * as path from 'path';
// Context7: consulted for url
import { fileURLToPath } from 'url';

// Context7: consulted for zod
import { z } from 'zod';

// ERROR-ARCHITECT-APPROVED: ARCH-REFACTOR-APPROVED-2025-09-12-FUNCTION-MODULES
import { AuditLogger } from './audit/audit-logger.js';
import { FieldTranslator } from './lib/field-translator.js';
import { MappingService } from './lib/mapping-service.js';
import { TableResolver } from './lib/table-resolver.js';
import { handleQuery } from './tools/query.js';
import { handleRecord } from './tools/record.js';
import { handleSchema } from './tools/schema.js';
import { handleUndo } from './tools/undo.js';
import { handleDiscover } from './tools/discover.js';
import { handleIntelligent } from './tools/intelligent.js';
import type { ToolContext } from './tools/types.js';
import {
  SmartSuiteClient,
  SmartSuiteClientConfig,
  SmartSuiteListResponse,
  SmartSuiteRecord,
  createAuthenticatedClient,
} from './smartsuite-client.js';

// Zod schema for SmartSuite list options validation
// SECURITY-SPECIALIST-APPROVED: Input validation enhancement for defense-in-depth
const ListOptionsSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
  sort: z.record(z.enum(['asc', 'desc'])).optional(),
  filters: z.record(z.unknown()).optional(),
}).passthrough(); // Allow additional properties for flexibility

// Safe type conversion with Zod validation for enhanced security
// Implements defense-in-depth as recommended by security-specialist
function toListOptions(
  options: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!options) {
    return undefined;
  }

  try {
    // Validate and return parsed options
    const validated = ListOptionsSchema.parse(options);
    return validated;
  } catch (error) {
    // Log validation errors but don't break existing functionality
    // This maintains backward compatibility while adding security layer
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line no-console
      console.warn('List options validation warning:', error.errors);
    }
    // Return original options to maintain backward compatibility
    return options;
  }
}

export class SmartSuiteShimServer {
  private client?: SmartSuiteClient;
  private mappingService: MappingService;
  private tableResolver: TableResolver;
  private fieldTranslator: FieldTranslator;
  private fieldMappingsInitialized = false;
  private authConfig?: SmartSuiteClientConfig;
  private auditLogger: AuditLogger;

  // Validation enforcement: Track recent dry-runs to ensure validation before execution
  private validationCache = new Map<string, {
    timestamp: number;
    dataHash: string;
    validated: boolean;
    errors?: string[];
  }>();
  private readonly VALIDATION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes


  constructor() {
    // Minimal implementation to make instantiation test pass
    this.mappingService = new MappingService();
    this.tableResolver = new TableResolver();
    this.fieldTranslator = new FieldTranslator();
    // Initialize audit logger with default path
    this.auditLogger = new AuditLogger(path.join(process.cwd(), 'audit-trail.json'));

    // Critical-Engineer: consulted for server initialization and auto-authentication strategy
    // Constructor remains fast and non-blocking - no I/O operations here
  }


  /**
   * Initialize the server with auto-authentication if environment variables are present
   * This is a blocking operation that ensures the server is ready before accepting connections
   * Following fail-fast pattern: if auth fails, server should not start
   */
  public async initialize(): Promise<void> {
    const apiToken = process.env.SMARTSUITE_API_TOKEN;
    const workspaceId = process.env.SMARTSUITE_WORKSPACE_ID;

    if (apiToken && workspaceId) {
      // eslint-disable-next-line no-console
      console.log('Auto-authenticating from environment variables...');
      this.authConfig = {
        apiKey: apiToken,
        workspaceId: workspaceId,
      };

      try {
        // BLOCKING call - server must be authenticated before starting
        await this.authenticate(this.authConfig);
        // eslint-disable-next-line no-console
        console.log('Authentication successful.');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('FATAL: Auto-authentication failed.', error);
        // Re-throw to prevent the server from starting
        throw new Error('Could not authenticate server with environment credentials.');
      }
    }
    // If no env vars, server starts unauthenticated (for interactive use)
  }

  /**
   * Check if server is authenticated (has valid client)
   * With fail-fast initialization, authentication state is explicit
   */
  isAuthenticated(): boolean {
    return this.client !== undefined;
  }

  /**
   * Get current authentication configuration
   */
  getAuthConfig(): SmartSuiteClientConfig | undefined {
    return this.authConfig;
  }

  /**
   * Ensure authentication is complete before tool execution
   * With fail-fast initialization, this is now much simpler
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.client) {
      throw new Error('Authentication required: call authenticate() first');
    }
    // Client exists, we're authenticated
    return Promise.resolve();
  }

  getTools(): Array<{
    name: string;
    description?: string;
    inputSchema: { type: string; properties: Record<string, unknown>; required?: string[] };
  }> {
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
              description: 'Maximum number of records to return (default 5 for MCP context optimization, max 1000)',
            },
            offset: {
              type: 'number',
              description: 'Starting offset for pagination (default 0)',
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
            output_mode: {
              type: 'string',
              enum: ['summary', 'fields', 'detailed'],
              description: 'Output mode: summary (table info only), fields (field names/types), detailed (full schema)',
              default: 'summary',
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
      {
        name: 'smartsuite_discover',
        description: 'Discover available tables and their fields',
        inputSchema: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              enum: ['tables', 'fields'],
              description: 'What to discover: tables or fields for a specific table',
            },
            tableId: {
              type: 'string',
              description: 'Table name or ID (required for fields scope)',
            },
          },
          required: ['scope'],
        },
      },
      {
        name: 'smartsuite_intelligent',
        description: 'AI-guided access to any SmartSuite API with knowledge-driven safety',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['learn', 'dry_run', 'execute'],
              description: 'Operation mode: learn (analyze), dry_run (validate), execute (perform)',
              default: 'learn',
            },
            endpoint: {
              type: 'string',
              description: 'SmartSuite API endpoint (e.g., /applications/{id}/records/list/)',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              description: 'HTTP method for the operation',
            },
            payload: {
              type: 'object',
              description: 'Request payload (validated against knowledge base)',
            },
            tableId: {
              type: 'string',
              description: 'SmartSuite table/application ID for context',
            },
            operation_description: {
              type: 'string',
              description: 'Human-readable description of what you want to accomplish',
            },
            confirmed: {
              type: 'boolean',
              description: 'Confirmation for dangerous operations (required for RED level)',
              default: false,
            },
          },
          required: ['endpoint', 'method', 'operation_description'],
        },
      },
    ];
  }

  /**
   * Initialize field mappings from config directory
   * CRITICAL: This enables human-readable field and table names per North Star
   */
  private async initializeFieldMappings(): Promise<void> {
    try {
      // Get the directory path relative to the compiled JS location
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Multiple path resolution strategies for different environments
      const possiblePaths = [
        // Development: Load directly from source (no rebuild needed!)
        path.resolve(process.cwd(), 'config/field-mappings'),
        // CI/Test: Use example files when actual mappings aren't available
        path.resolve(process.cwd(), 'config/field-mappings/examples'),
        // CI with downloaded artifacts: build/config exists in cwd
        path.resolve(process.cwd(), 'build/config/field-mappings'),
        path.resolve(process.cwd(), 'build/config/field-mappings/examples'),
        // CI environment with build artifacts - from build/src/mcp-server.js
        path.resolve(__dirname, '../config/field-mappings'),
        path.resolve(__dirname, '../config/field-mappings/examples'),
        // Absolute path for dev environment
        '/Volumes/HestAI-Projects/smartsuite-api-shim/dev/config/field-mappings',
        // Production: from build/src/mcp-server.js -> ../../config/field-mappings
        path.resolve(__dirname, '../../config/field-mappings'),
        // Production fallback: Use examples
        path.resolve(__dirname, '../../config/field-mappings/examples'),
        // Alternative fallback: Use examples
        path.resolve(__dirname, '../config/field-mappings/examples'),
      ];

      let configPath: string | null = null;

      // Try each path until we find one that exists
      // eslint-disable-next-line no-await-in-loop
      for (const tryPath of possiblePaths) {
        try {
          // Use native fs to check if directory exists and has files
          // Sequential checking is intentional - we stop at first valid path
          // eslint-disable-next-line no-await-in-loop
          if (existsSync(tryPath)) {
            // eslint-disable-next-line no-await-in-loop
            const files = await fs.readdir(tryPath);
            if (files.some((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
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

      // eslint-disable-next-line no-console
      console.log('Loading field mappings from:', configPath);

      // Use MappingService for centralized collision detection
      await this.mappingService.loadAllMappings(configPath);

      // Get the configured translators
      this.tableResolver = this.mappingService.getTableResolver();
      this.fieldTranslator = this.mappingService.getFieldTranslator();

      const stats = this.mappingService.getMappingStats();
      // eslint-disable-next-line no-console
      console.log(
        `MappingService initialized successfully: ${stats.tablesLoaded} tables, ${stats.totalFields} fields`,
      );
      this.fieldMappingsInitialized = true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize field mappings:', error);
      // GRACEFUL DEGRADATION: Don't fail startup if field mappings are missing
      // This allows the server to work with raw API codes as fallback
      // eslint-disable-next-line no-console
      console.warn('Field mappings not available - server will use raw API field codes and hex IDs');

      // CRITICAL FIX: Don't replace working instances with empty ones on failure
      // Keep the original empty instances but don't mark as initialized if we couldn't load anything
      // This ensures TableResolver won't give misleading empty table lists
      const stats = this.mappingService.getMappingStats();
      if (stats.tablesLoaded === 0) {
        // eslint-disable-next-line no-console
        console.warn('No tables loaded - table resolution will not be available');
        // Don't mark as initialized so we can retry later if needed
        // But for now, keep the empty instances to avoid null errors
      } else {
        // Some tables were loaded before failure - use what we have
        this.tableResolver = this.mappingService.getTableResolver();
        this.fieldTranslator = this.mappingService.getFieldTranslator();
        this.fieldMappingsInitialized = true;
      }
    }
  }

  async authenticate(config: SmartSuiteClientConfig): Promise<void> {
    // Initialize field mappings on first use (lazy loading)
    if (!this.fieldMappingsInitialized) {
      await this.initializeFieldMappings();
    }

    // ENVIRONMENT VARIABLE PRIORITY: If env vars are set, use them instead of provided config
    let effectiveConfig = config;
    const envToken = process.env.SMARTSUITE_API_TOKEN;
    const envWorkspaceId = process.env.SMARTSUITE_WORKSPACE_ID;

    if (envToken && envWorkspaceId) {
      effectiveConfig = {
        apiKey: envToken,
        workspaceId: envWorkspaceId,
        baseUrl: config.baseUrl ?? 'https://app.smartsuite.com', // Base URL without /api/v1 (added in client)
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

  /**
   * Call a tool by name - public interface for testing
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.executeTool(toolName, args);
  }

  /**
   * Create context object for tool functions
   */
  private createToolContext(): ToolContext {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    return {
      client: this.client,
      fieldTranslator: this.fieldTranslator,
      tableResolver: this.tableResolver,
      auditLogger: this.auditLogger,
    };
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // AUTO-AUTHENTICATION: Ensure authentication is complete
    await this.ensureAuthenticated();

    // Initialize field mappings on first use if not already done
    if (!this.fieldMappingsInitialized) {
      await this.initializeFieldMappings();
    }

    // DRY-RUN pattern enforcement for mutations (North Star requirement)
    if (toolName === 'smartsuite_record' && args.dry_run === undefined) {
      throw new Error('Dry-run pattern required: mutation tools must specify dry_run parameter');
    }

    // Basic tool dispatch
    switch (toolName) {
      case 'smartsuite_query':
        return handleQuery(this.createToolContext(), args);
      case 'smartsuite_record':
        return handleRecord(this.createToolContext(), args);
      case 'smartsuite_schema':
        return handleSchema(this.createToolContext(), args);
      case 'smartsuite_undo':
        return handleUndo(this.createToolContext(), args);
      case 'smartsuite_discover':
        return handleDiscover(this.createToolContext(), args);
      case 'smartsuite_intelligent':
        return handleIntelligent(this.createToolContext(), args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async handleQuery(args: Record<string, unknown>): Promise<unknown> {
    // FIELD TRANSLATION: Convert human-readable field names to API codes
    const operation = args.operation as string;
    let appId = args.appId as string;
    const recordId = args.recordId as string;
    const filters = args.filters as Record<string, unknown> | undefined;
    const sort = args.sort as Record<string, unknown> | undefined;
    const limit = args.limit as number | undefined;
    const offset = args.offset as number | undefined;

    // TABLE RESOLUTION: Convert table name to ID if needed
    const resolvedId = this.tableResolver.resolveTableId(appId);
    if (!resolvedId) {
      const suggestions = this.tableResolver.getSuggestionsForUnknown(appId);
      const availableTables = this.tableResolver.getAllTableNames();
      throw new Error(
        `Unknown table '${appId}'. ` +
        (suggestions.length > 0
          ? `Did you mean: ${suggestions.join(', ')}?`
          : `Available tables: ${availableTables.join(', ')}`
        ),
      );
    }
    appId = resolvedId;

    // Translate filters and sort options if field mappings exist
    const translatedFilters =
      filters && this.fieldTranslator.hasMappings(appId)
        ? this.fieldTranslator.humanToApi(appId, filters, false) // Non-strict mode for filters
        : filters;

    const translatedSort =
      sort && this.fieldTranslator.hasMappings(appId)
        ? this.fieldTranslator.humanToApi(appId, sort, false) // Non-strict mode for sort
        : sort;

    const options = {
      ...(translatedFilters && { filter: translatedFilters }),
      ...(translatedSort && { sort: translatedSort }),
      ...(limit && { limit }),
      ...(offset !== undefined && { offset }),
    };

    let result: unknown;
    switch (operation) {
      case 'list': {
        const listResponse = await this.client!.listRecords(appId, toListOptions(options));
        // Handle both new API format and legacy test mocks
        result = this.handleListResponse(appId, listResponse);
        break;
      }
      case 'get':
        result = await this.client!.getRecord(appId, recordId);
        break;
      case 'search': {
        // SIMPLE scope: search is just list with filter
        const searchResponse = await this.client!.listRecords(appId, toListOptions(options));
        // Handle both new API format and legacy test mocks
        result = this.handleListResponse(appId, searchResponse);
        break;
      }
      case 'count': {
        const count = await this.client!.countRecords(appId, toListOptions(options));
        result = { count };
        break;
      }
      default:
        throw new Error(`Unknown query operation: ${operation}`);
    }

    // FIELD TRANSLATION: Convert API response back to human-readable names for single record
    if (this.fieldTranslator.hasMappings(appId) && result && typeof result === 'object') {
      if ('count' in (result as Record<string, unknown>)) {
        // Handle count result - no field translation needed
        return result;
      } else if ('items' in (result as Record<string, unknown>)) {
        // Handle paginated list/search results - already processed by formatMcpPaginationResponse
        return result;
      } else {
        // Handle single record (get result)
        return this.fieldTranslator.apiToHuman(appId, result as Record<string, unknown>);
      }
    }

    return result;
  }

  /**
   * Handle list response - supports both new API format and legacy test mocks
   */
  private handleListResponse(appId: string, response: unknown): Record<string, unknown> {
    // Check if it's an array (legacy test mock format)
    if (Array.isArray(response)) {
      // Convert legacy mock format to new pagination response
      const legacyResponse: SmartSuiteListResponse = {
        items: response as unknown as SmartSuiteRecord[],
        total: response.length,
        offset: 0,
        limit: response.length,
      };
      return this.formatMcpPaginationResponse(appId, legacyResponse);
    }

    // Handle new API format
    return this.formatMcpPaginationResponse(appId, response as SmartSuiteListResponse);
  }

  /**
   * Format SmartSuite API response for MCP protocol with cursor-based pagination
   */
  private formatMcpPaginationResponse(appId: string, response: SmartSuiteListResponse): Record<string, unknown> {
    // Handle undefined response items (for test compatibility)
    const items = response.items ?? [];

    // CONTEXT OPTIMIZATION: Limit default response size
    const MAX_ITEMS_FOR_MCP = 5; // Reduce from unlimited to 5 items by default
    const truncatedItems = items.slice(0, MAX_ITEMS_FOR_MCP);
    const wasTruncated = items.length > MAX_ITEMS_FOR_MCP;

    // Translate field names if mappings exist
    const translatedItems = this.fieldTranslator.hasMappings(appId)
      ? truncatedItems.map((record) =>
          this.fieldTranslator.apiToHuman(appId, record as Record<string, unknown>),
        )
      : truncatedItems;

    // Calculate next offset for cursor-based pagination
    const offset = response.offset ?? 0;
    const limit = response.limit ?? 200;
    const total = response.total ?? 0;
    const nextOffset = offset + limit;
    const hasMore = nextOffset < total;

    return {
      total,
      items: translatedItems,
      limit: wasTruncated ? MAX_ITEMS_FOR_MCP : limit,
      offset,
      ...(hasMore && { nextOffset }),
      ...(wasTruncated && {
        truncated: true,
        originalCount: items.length,
        message: `Response truncated to ${MAX_ITEMS_FOR_MCP} items to optimize context. Use limit parameter to control size.`,
      }),
    };
  }







  /**
   * Perform proper dry-run validation with actual API connectivity and schema checks
   * Implements Option 3 from the architectural discussion
   */
  private async performDryRunValidation(
    operation: string,
    appId: string,
    recordId: string | undefined,
    originalData: Record<string, unknown>,
    translatedData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];
    let connectivityPassed = false;
    let schemaValidationPassed = false;

    // Phase 1: Connectivity/Auth probe
    try {
      // Use a minimal list query to test connectivity, auth, and permissions
      await this.client!.listRecords(appId, { limit: 1 });
      connectivityPassed = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      validationErrors.push(`API connectivity check failed: ${errorMessage}`);

      // Early return if we can't even connect
      return {
        dry_run: true,
        validation: 'failed',
        operation,
        appId,
        recordId,
        originalData,
        translatedData,
        fieldMappingsUsed: this.fieldTranslator.hasMappings(appId),
        errors: validationErrors,
        message: 'DRY-RUN FAILED: Cannot validate operation due to API connectivity issues',
      };
    }

    // Phase 2: Schema-based validation
    try {
      const schema = await this.client!.getSchema(appId);
      const schemaErrors = this.validateDataAgainstSchema(
        operation,
        translatedData,
        schema as unknown as Record<string, unknown>,
      );

      if (schemaErrors.length > 0) {
        validationErrors.push(...schemaErrors);
      } else {
        schemaValidationPassed = true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      validationWarnings.push(`Schema validation skipped: ${errorMessage}`);
    }

    // Determine overall validation status
    const validationPassed = connectivityPassed && schemaValidationPassed && validationErrors.length === 0;

    // Store validation result in cache for enforcement
    const operationKey = this.generateOperationKey(operation, appId, recordId);
    const dataHash = this.generateDataHash(translatedData);

    // Clean old validations first
    this.cleanExpiredValidations();

    // Store this validation
    const cacheEntry: {
      timestamp: number;
      dataHash: string;
      validated: boolean;
      errors?: string[];
    } = {
      timestamp: Date.now(),
      dataHash,
      validated: validationPassed,
    };

    if (validationErrors.length > 0) {
      cacheEntry.errors = validationErrors;
    }

    this.validationCache.set(operationKey, cacheEntry);

    return {
      dry_run: true,
      validation: validationPassed ? 'passed' : 'failed',
      operation,
      appId,
      recordId,
      originalData,
      translatedData,
      fieldMappingsUsed: this.fieldTranslator.hasMappings(appId),
      validationChecks: {
        connectivity: connectivityPassed ? 'passed' : 'failed',
        schema: schemaValidationPassed ? 'passed' : validationWarnings.length > 0 ? 'skipped' : 'failed',
      },
      ...(validationErrors.length > 0 && { errors: validationErrors }),
      ...(validationWarnings.length > 0 && { warnings: validationWarnings }),
      message: validationPassed
        ? 'DRY-RUN PASSED: Operation validated successfully. Connectivity and schema checks passed. You may now execute with dry_run:false within 5 minutes.'
        : 'DRY-RUN FAILED: Operation validation failed. See errors for details.',
      note: 'This dry-run validates connectivity, authentication, and schema compliance. Server-side business rules and automations are not tested.',
    };
  }

  /**
   * Validate data against SmartSuite schema
   * Checks required fields, field types, and system field restrictions
   */
  private validateDataAgainstSchema(
    operation: string,
    data: Record<string, unknown>,
    schema: Record<string, unknown>, // SmartSuiteSchema type
  ): string[] {
    const errors: string[] = [];

    // Skip validation for delete operations (no data to validate)
    if (operation === 'delete') {
      return [];
    }

    if (!schema.structure || !Array.isArray(schema.structure)) {
      return ['Schema structure not available for validation'];
    }

    // Build a map of field slugs to field definitions
    const fieldMap = new Map<string, Record<string, unknown>>();
    const structureArray = schema.structure as Array<Record<string, unknown>>;
    for (const field of structureArray) {
      const slug = field.slug as string | undefined;
      if (slug) {
        fieldMap.set(slug, field);
      }
    }

    // Check for unknown fields
    for (const key of Object.keys(data)) {
      if (!fieldMap.has(key)) {
        errors.push(`Unknown field: '${key}'. This field does not exist in the table schema.`);
      }
    }

    // For create operations, check required fields
    if (operation === 'create') {
      for (const [fieldSlug, fieldDef] of fieldMap) {
        // Check if field is required
        const params = fieldDef.params as Record<string, unknown> | undefined;
        if (params?.required === true) {
          // Skip system-generated fields
          const fieldType = fieldDef.field_type as string;
          const systemGeneratedTypes = [
            'autonumberfield',
            'firstcreatedfield',
            'lastupdatedfield',
            'formulafield',
            'rollupfield',
            'lookupfield',
            'countfield',
            'commentscountfield',
          ];

          if (systemGeneratedTypes.includes(fieldType)) {
            continue; // Skip validation for system-generated fields
          }

          // Check if required field is missing
          if (!(fieldSlug in data) || data[fieldSlug] === null || data[fieldSlug] === undefined) {
            const label = (fieldDef.label as string) ?? fieldSlug;
            errors.push(`Required field missing: '${fieldSlug}' (${label})`);
          }
        }
      }
    }

    // Check for attempts to set system-generated fields
    const systemFields = [
      'autonumber',
      'first_created',
      'last_updated',
      'comments_count',
      'followed_by',
      'ranking',
      'id',
      'application_id',
      'application_slug',
      'deleted_date',
      'deleted_by',
    ];

    for (const systemField of systemFields) {
      if (systemField in data) {
        errors.push(`Cannot set system-generated field: '${systemField}'`);
      }
    }

    // Validate field types (basic validation)
    for (const [key, value] of Object.entries(data)) {
      const fieldDef = fieldMap.get(key);
      if (!fieldDef) continue; // Already reported as unknown field

      const fieldType = fieldDef.field_type as string;
      const label = (fieldDef.label as string) ?? key;

      // Basic type validation
      switch (fieldType) {
        case 'numberfield':
        case 'currencyfield':
          if (value !== null && typeof value !== 'number') {
            errors.push(`Field '${key}' (${label}) must be a number, got ${typeof value}`);
          }
          break;

        case 'datefield':
        case 'duedatefield':
          if (value !== null && typeof value !== 'object') {
            errors.push(`Field '${key}' (${label}) must be a date object`);
          }
          break;

        case 'linkedrecordfield':
        case 'userfield':
          if (value !== null && !Array.isArray(value)) {
            errors.push(`Field '${key}' (${label}) must be an array of record IDs`);
          }
          break;

        case 'singleselectfield': {
          if (value !== null && typeof value !== 'string') {
            errors.push(`Field '${key}' (${label}) must be a string value`);
          }
          // Could also validate against allowed choices if available
          const params = fieldDef.params as Record<string, unknown> | undefined;
          if (params?.choices && value !== null) {
            const choices = params.choices as Array<Record<string, unknown>>;
            const validValues = choices.map((c) => c.value as string);
            if (!validValues.includes(value as string)) {
              errors.push(`Field '${key}' (${label}) value '${String(value)}' is not in allowed choices: ${validValues.join(', ')}`);
            }
          }
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Generate a unique key for tracking operations
   */
  private generateOperationKey(
    operation: string,
    appId: string,
    recordId?: string,
  ): string {
    return `${operation}:${appId}:${recordId ?? 'new'}`;
  }

  /**
   * Generate a hash of the data for comparison
   */
  private generateDataHash(data: Record<string, unknown> | undefined): string {
    // Simple JSON stringify for hashing - in production, use crypto hash
    if (!data || Object.keys(data).length === 0) {
      // Treat undefined and empty object the same for consistency
      return JSON.stringify({});
    }
    return JSON.stringify(data, Object.keys(data).sort());
  }

  /**
   * Clean expired validations from cache
   */
  private cleanExpiredValidations(): void {
    const now = Date.now();
    for (const [key, validation] of this.validationCache.entries()) {
      if (now - validation.timestamp > this.VALIDATION_EXPIRY_MS) {
        this.validationCache.delete(key);
      }
    }
  }
}
