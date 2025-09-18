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

// ERROR-ARCHITECT-APPROVED: ARCH-REFACTOR-APPROVED-2025-09-12-FUNCTION-MODULES
import { AuditLogger } from './audit/audit-logger.js';
import { FieldTranslator } from './lib/field-translator.js';
import { MappingService } from './lib/mapping-service.js';
import { TableResolver } from './lib/table-resolver.js';
import logger from './logger.js';
import {
  SmartSuiteClient,
  SmartSuiteClientConfig,
  createAuthenticatedClient,
} from './smartsuite-client.js';
// Technical-Architect: Switch to Sentinel Architecture registration
import { defaultToolRegistry, registerSentinelTools } from './tools/tool-definitions.js';
import type { ToolContext } from './tools/types.js';
import { McpValidationError } from './validation/input-validator.js';

export class SmartSuiteShimServer {
  private client?: SmartSuiteClient;
  private mappingService: MappingService;
  private tableResolver: TableResolver;
  private fieldTranslator: FieldTranslator;
  private fieldMappingsInitialized = false;
  private authConfig?: SmartSuiteClientConfig;
  private auditLogger: AuditLogger;

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
    // Critical-Engineer: consulted for Architecture pattern selection (Tool Registry)
    // Register all tools with error-resistant implementation and fail-fast pattern
    try {
      // Technical-Architect: Activate Sentinel Architecture with only 2 tools
      registerSentinelTools();
    } catch (error) {
      logger.error(
        'FATAL: Tool registration failed:',
        error instanceof Error ? error.message : String(error),
      );
      throw new Error('Cannot start server: Tool system failed to initialize properly.');
    }

    const apiToken = process.env.SMARTSUITE_API_TOKEN;
    const workspaceId = process.env.SMARTSUITE_WORKSPACE_ID;
    const skipAutoAuth = process.env.SKIP_AUTO_AUTH === 'true';

    if (apiToken && workspaceId && !skipAutoAuth) {
      logger.info('Auto-authenticating from environment variables...');
      this.authConfig = {
        apiKey: apiToken,
        workspaceId: workspaceId,
      };

      try {
        // BLOCKING call - server must be authenticated before starting
        await this.authenticate(this.authConfig);

        logger.info('Authentication successful.');
      } catch (error) {
        logger.error('FATAL: Auto-authentication failed.', error);
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
  private ensureAuthenticated(): void {
    if (!this.client) {
      throw new Error('Authentication required: call authenticate() first');
    }
    // Client exists, we're authenticated
  }

  getTools(): Array<{
    name: string;
    description?: string;
    inputSchema: { type: string; properties: Record<string, unknown>; required?: string[] };
  }> {
    // Technical-Architect: SENTINEL ARCHITECTURE ACTIVATED
    // Reduced tool surface from 9 tools to 2 tools (facade + undo)
    // All query, record, schema, discover, and knowledge operations route through the facade
    logger.info('Sentinel Architecture: Exposing 2 tools (facade + undo) instead of 9');

    // SENTINEL ARCHITECTURE: Return only the 2 facade tools
    return [
      {
        name: 'smartsuite_intelligent',
        description:
          'Unified SmartSuite operations interface - handles all queries, records, schemas, and discovery through intelligent routing',
        inputSchema: {
          type: 'object',
          properties: {
            // Deterministic routing field (recommended for agent clarity)
            tool_name: {
              type: 'string',
              enum: [
                'smartsuite_query',
                'smartsuite_record',
                'smartsuite_schema',
                'smartsuite_undo',
                'smartsuite_discover',
                'smartsuite_intelligent',
                'smartsuite_knowledge_events',
                'smartsuite_knowledge_field_mappings',
                'smartsuite_knowledge_refresh_views',
              ],
              description: 'Explicit tool routing - use this for deterministic behavior',
            },
            // Core intelligent tool fields
            endpoint: {
              type: 'string',
              description: 'SmartSuite API endpoint',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              description: 'HTTP method for the operation',
            },
            operation_description: {
              type: 'string',
              description: 'Human-readable description of what you want to accomplish',
            },
            payload: {
              type: 'object',
              description: 'Request payload',
            },
            tableId: {
              type: 'string',
              description: 'SmartSuite table/application ID',
            },
            mode: {
              type: 'string',
              enum: ['learn', 'dry_run', 'execute'],
              description: 'Operation mode',
              default: 'learn',
            },
            confirmed: {
              type: 'boolean',
              description: 'Confirmation for dangerous operations',
              default: false,
            },
            // Additional routing fields for comprehensive operations
            operation: {
              type: 'string',
              description: 'Operation type (for query/record tools)',
            },
            appId: {
              type: 'string',
              description: 'SmartSuite application ID (24-char hex)',
            },
            recordId: {
              type: 'string',
              description: 'Record ID (for get/update/delete operations)',
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
            offset: {
              type: 'number',
              description: 'Starting offset for pagination',
            },
            data: {
              type: 'object',
              description: 'Record data for create/update operations',
            },
            dry_run: {
              type: 'boolean',
              description: 'Preview changes without executing',
              default: true,
            },
            output_mode: {
              type: 'string',
              description: 'Schema output mode (summary/fields/detailed)',
            },
            scope: {
              type: 'string',
              description: 'Discovery scope (tables/fields)',
            },
            transaction_id: {
              type: 'string',
              description: 'Transaction ID for undo operations',
            },
            aggregateId: {
              type: 'string',
              description: 'Aggregate ID for knowledge events',
            },
            event: {
              type: 'object',
              description: 'Event data for knowledge operations',
            },
            views: {
              type: 'array',
              items: { type: 'string' },
              description: 'Views to refresh',
            },
          },
          required: ['operation_description'],
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

      for (const tryPath of possiblePaths) {
        try {
          // Use native fs to check if directory exists and has files
          // Sequential checking is intentional - we stop at first valid path

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

      logger.info('Loading field mappings from:', configPath);

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
      console.warn(
        'Field mappings not available - server will use raw API field codes and hex IDs',
      );

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
    return await this.executeTool(toolName, args);
  }

  /**
   * Create context object for tool functions
   */
  private createToolContext(): ToolContext {
    // This should never happen if ensureAuthenticated() was called
    // But we keep the check for safety
    if (!this.client) {
      throw new Error('Authentication required: call authenticate() first');
    }
    return {
      client: this.client,
      fieldTranslator: this.fieldTranslator,
      tableResolver: this.tableResolver,
      auditLogger: this.auditLogger,
    };
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // AUTO-AUTHENTICATION: Ensure authentication is complete FIRST
    // This must happen before createToolContext() to avoid "Cannot read properties of undefined"
    this.ensureAuthenticated();

    // Initialize field mappings on first use if not already done
    if (!this.fieldMappingsInitialized) {
      await this.initializeFieldMappings();
    }

    // Use type-safe registry for tool execution with preserved McpValidationError structure
    // Registry handles validation, type safety, observability, and error handling
    try {
      // Now safe to create context since we've verified authentication
      return await defaultToolRegistry.execute(toolName, this.createToolContext(), args);
    } catch (error) {
      // Preserve McpValidationError structure but provide backward-compatible error format
      if (error instanceof McpValidationError) {
        throw new Error(`${error.message}: ${error.validationErrors.join(', ')}`);
      }
      throw error;
    }
  }
}
