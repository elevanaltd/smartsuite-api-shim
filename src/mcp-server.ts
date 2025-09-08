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
import {
  SmartSuiteClient,
  SmartSuiteClientConfig,
  SmartSuiteListResponse,
  SmartSuiteRecord,
  createAuthenticatedClient,
} from './smartsuite-client.js';

// Safe type conversion for lint cleanup - preserves runtime behavior
// Updated to handle new SmartSuiteListOptions interface with offset
function toListOptions(
  options: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  // LINT_CLEANUP: Conservative conversion maintains existing behavior
  // TODO: Future enhancement - add Zod schema validation per Critical-Engineer recommendation
  return options;
}

export class SmartSuiteShimServer {
  private client?: SmartSuiteClient;
  private fieldTranslator: FieldTranslator;
  private fieldMappingsInitialized = false;
  private authConfig?: SmartSuiteClientConfig;

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
    this.fieldTranslator = new FieldTranslator();

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
              description: 'Maximum number of records to return (default 200, max 1000)',
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
        // Development: Load directly from source (no rebuild needed!)
        path.resolve(process.cwd(), 'config/field-mappings'),
        // Absolute path for dev environment
        '/Volumes/HestAI-Projects/smartsuite-api-shim/dev/config/field-mappings',
        // Production: from build/src/mcp-server.js -> ../../config/field-mappings
        path.resolve(__dirname, '../../config/field-mappings'),
        // Alternative: from src/mcp-server.js -> ../config/field-mappings
        path.resolve(__dirname, '../config/field-mappings'),
      ];

      let configPath: string | null = null;

      // Import fs-extra once outside the loop for performance
      const fs = await import('fs-extra');

      // Try each path until we find one that exists
      // eslint-disable-next-line no-await-in-loop
      for (const tryPath of possiblePaths) {
        try {
          // Use fs-extra to check if directory exists and has files
          // Sequential checking is intentional - we stop at first valid path
          // eslint-disable-next-line no-await-in-loop
          if (await fs.pathExists(tryPath)) {
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
      await this.fieldTranslator.loadAllMappings(configPath);
      // eslint-disable-next-line no-console
      console.log(
        'FieldTranslator initialized successfully with',
        this.fieldTranslator['mappings'].size,
        'mappings',
      );
      this.fieldMappingsInitialized = true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize field mappings:', error);
      // GRACEFUL DEGRADATION: Don't fail startup if field mappings are missing
      // This allows the server to work with raw API codes as fallback
      // eslint-disable-next-line no-console
      console.warn('Field mappings not available - server will use raw API field codes');
      // Mark as initialized even though we failed, to avoid repeated attempts
      this.fieldMappingsInitialized = true;
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
    const offset = args.offset as number | undefined;

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

    // Translate field names if mappings exist
    const translatedItems = this.fieldTranslator.hasMappings(appId)
      ? items.map((record) =>
          this.fieldTranslator.apiToHuman(appId, record as Record<string, unknown>),
        )
      : items;

    // Calculate next offset for cursor-based pagination
    const offset = response.offset ?? 0;
    const limit = response.limit ?? 200;
    const total = response.total ?? 0;
    const nextOffset = offset + limit;
    const hasMore = nextOffset < total;

    return {
      total,
      items: translatedItems,
      limit,
      offset,
      ...(hasMore && { nextOffset }),
    };
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
    const translatedData =
      inputData && this.fieldTranslator.hasMappings(appId)
        ? this.fieldTranslator.humanToApi(appId, inputData, true) // Strict mode for data
        : inputData;

    if (dry_run) {
      // Perform proper validation with actual API checks
      return this.performDryRunValidation(operation, appId, recordId, inputData, translatedData);
    }

    // ENFORCEMENT: Check if a successful dry-run was performed for this operation
    const operationKey = this.generateOperationKey(operation, appId, recordId);
    const dataHash = this.generateDataHash(translatedData);

    // Clean expired validations
    this.cleanExpiredValidations();

    // Check for valid prior validation
    const priorValidation = this.validationCache.get(operationKey);

    if (!priorValidation) {
      throw new Error(
        'Validation required: No dry-run found for this operation. ' +
        'You must perform a dry-run (dry_run: true) before executing. ' +
        'This ensures the operation is validated before execution.',
      );
    }

    // Check if validation is expired
    if (Date.now() - priorValidation.timestamp > this.VALIDATION_EXPIRY_MS) {
      this.validationCache.delete(operationKey);
      throw new Error(
        'Validation expired: The dry-run for this operation has expired (>5 minutes old). ' +
        'Please perform a new dry-run before executing.',
      );
    }

    // Check if data has changed
    if (priorValidation.dataHash !== dataHash) {
      this.validationCache.delete(operationKey);
      throw new Error(
        'Data mismatch: The data has changed since the dry-run validation. ' +
        'The data must be identical between dry-run and execution. ' +
        'Please perform a new dry-run with the current data.',
      );
    }

    // Check if prior validation failed
    if (!priorValidation.validated) {
      this.validationCache.delete(operationKey);
      const errors = priorValidation.errors?.join(', ') ?? 'Validation failed';
      throw new Error(
        `Cannot execute: The dry-run validation failed with errors: ${errors}. ` +
        'Please fix the issues and perform a new dry-run.',
      );
    }

    // Validation passed - clear it from cache (single use)
    this.validationCache.delete(operationKey);

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
    if (
      this.fieldTranslator.hasMappings(appId) &&
      result &&
      typeof result === 'object' &&
      !('deleted' in (result as Record<string, unknown>))
    ) {
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
          message:
            'This table supports human-readable field names. Use field names from the mappings below instead of API codes.',
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

  /**
   * Generate a unique key for tracking operations
   */
  private generateOperationKey(
    operation: string,
    appId: string,
    recordId?: string,
  ): string {
    return `${operation}:${appId}:${recordId || 'new'}`;
  }

  /**
   * Generate a hash of the data for comparison
   */
  private generateDataHash(data: Record<string, unknown>): string {
    // Simple JSON stringify for hashing - in production, use crypto hash
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
}
