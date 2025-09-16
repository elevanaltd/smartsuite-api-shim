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
import {
  SmartSuiteClient,
  SmartSuiteClientConfig,
  createAuthenticatedClient,
} from './smartsuite-client.js';
import { handleDiscover } from './tools/discover.js';
import { handleIntelligent } from './tools/intelligent.js';
import {
  handleKnowledgeEvents,
  handleKnowledgeFieldMappings,
  handleKnowledgeRefreshViews,
  type KnowledgeEventsArgs,
  type KnowledgeFieldMappingsArgs,
  type KnowledgeRefreshViewsArgs,
} from './tools/knowledge.js';
import { handleQuery } from './tools/query.js';
import { handleRecord } from './tools/record.js';
import { handleSchema } from './tools/schema.js';
import type { ToolContext } from './tools/types.js';
import { handleUndo } from './tools/undo.js';
// Context7: consulted for zod - already noted above
import { validateMcpToolInput, McpValidationError } from './validation/input-validator.js';
import { z } from 'zod';

// MCP Tool validation schemas
const QueryToolSchema = z.object({
  operation: z.enum(['list', 'get', 'search', 'count']),
  appId: z.string().min(1),
  filters: z.record(z.unknown()).optional(),
  sort: z.record(z.unknown()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  recordId: z.string().optional(),
});

const RecordToolSchema = z.object({
  operation: z.enum(['create', 'update', 'delete', 'bulk_update', 'bulk_delete']),
  appId: z.string().min(1),
  recordId: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  dry_run: z.boolean(),
});

const SchemaToolSchema = z.object({
  appId: z.string().min(1),
  output_mode: z.enum(['summary', 'fields', 'detailed']).optional(),
});

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
      {
        name: 'smartsuite_knowledge_events',
        description: 'Knowledge Platform event operations (append/get events)',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['append', 'get'],
              description: 'Event operation to perform',
            },
            aggregateId: {
              type: 'string',
              description: 'Aggregate ID for event operations',
            },
            event: {
              type: 'object',
              description: 'Event data for append operations',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of events to retrieve (for get operations)',
            },
          },
          required: ['operation'],
        },
      },
      {
        name: 'smartsuite_knowledge_field_mappings',
        description: 'Get field mappings from Knowledge Platform',
        inputSchema: {
          type: 'object',
          properties: {
            tableId: {
              type: 'string',
              description: 'SmartSuite table ID to get field mappings for',
            },
          },
          required: ['tableId'],
        },
      },
      {
        name: 'smartsuite_knowledge_refresh_views',
        description: 'Refresh Knowledge Platform materialized views',
        inputSchema: {
          type: 'object',
          properties: {
            views: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of views to refresh (default: field_mappings)',
            },
          },
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
    return await this.executeTool(toolName, args);
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

  /**
   * Validate tool input parameters using appropriate schema and SmartDoc validation
   */
  private validateToolInput(toolName: string, args: Record<string, unknown>): unknown {
    const schema = this.getValidationSchemaForTool(toolName);
    if (!schema) {
      return args; // No validation required for this tool
    }

    return validateMcpToolInput(toolName, schema, args);
  }

  /**
   * Get validation schema for a specific tool
   */
  private getValidationSchemaForTool(toolName: string): z.ZodSchema<any> | null {
    switch (toolName) {
      case 'smartsuite_query':
        return QueryToolSchema;
      case 'smartsuite_record':
        return RecordToolSchema;
      case 'smartsuite_schema':
        return SchemaToolSchema;
      default:
        return null;
    }
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // AUTO-AUTHENTICATION: Ensure authentication is complete
    this.ensureAuthenticated();

    // Initialize field mappings on first use if not already done
    if (!this.fieldMappingsInitialized) {
      await this.initializeFieldMappings();
    }

    // INPUT VALIDATION: Validate and transform inputs using validation middleware
    let validatedArgs: unknown;
    try {
      validatedArgs = this.validateToolInput(toolName, args);
    } catch (error) {
      if (error instanceof McpValidationError) {
        throw new Error(`${error.message}: ${error.validationErrors.join(', ')}`);
      }
      throw error;
    }

    // DRY-RUN pattern enforcement for mutations (project requirement)
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
      case 'smartsuite_knowledge_events':
        return handleKnowledgeEvents(args as unknown as KnowledgeEventsArgs, this.createToolContext());
      case 'smartsuite_knowledge_field_mappings':
        return handleKnowledgeFieldMappings(args as unknown as KnowledgeFieldMappingsArgs, this.createToolContext());
      case 'smartsuite_knowledge_refresh_views':
        return handleKnowledgeRefreshViews(args as unknown as KnowledgeRefreshViewsArgs, this.createToolContext());
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
