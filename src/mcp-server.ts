// TESTGUARD_BYPASS: TDD-GREEN-001 - Minimal implementation to pass failing test committed in 8272d0f
// Context7: consulted for @modelcontextprotocol/sdk (will be added when needed)
// Context7: consulted for zod
// Context7: consulted for winston
// Critical-Engineer: consulted for Architecture pattern selection
// Critical-Engineer: consulted for Architecture and Security Validation
// Critical-Engineer: consulted for Architecture pattern selection
// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250905-fba0d14b
import { SmartSuiteClient, SmartSuiteClientConfig, createAuthenticatedClient } from './smartsuite-client.js';

// Safe type conversion for lint cleanup - preserves runtime behavior
function toListOptions(options: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  // LINT_CLEANUP: Conservative conversion maintains existing behavior
  // TODO: Future enhancement - add Zod schema validation per Critical-Engineer recommendation
  return options;
}

export class SmartSuiteShimServer {
  private client?: SmartSuiteClient;

  constructor() {
    // Minimal implementation to make instantiation test pass
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

  async authenticate(config: SmartSuiteClientConfig): Promise<void> {
    // SIMPLE scope: Basic authentication with client storage
    this.client = await createAuthenticatedClient(config);
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // SIMPLE scope: Basic tool dispatch
    if (!this.client) {
      throw new Error('Authentication required: call authenticate() first');
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
    // SIMPLE scope: Basic query operations
    const operation = args.operation as string;
    const appId = args.appId as string;
    const recordId = args.recordId as string;
    const options = args.options as Record<string, unknown> | undefined;
    switch (operation) {
      case 'list':
        return this.client!.listRecords(appId, toListOptions(options));
      case 'get':
        return this.client!.getRecord(appId, recordId);
      case 'search':
        // SIMPLE scope: search is just list with filter
        return this.client!.listRecords(appId, toListOptions({ filter: options?.filter }));
      case 'count': {
        const records = await this.client!.listRecords(appId, toListOptions(options));
        return { count: records.length };
      }
      default:
        throw new Error(`Unknown query operation: ${operation}`);
    }
  }

  private async handleRecord(args: Record<string, unknown>): Promise<unknown> {
    // SIMPLE scope: Record mutations with dry-run safety
    const operation = args.operation as string;
    const appId = args.appId as string;
    const recordId = args.recordId as string;
    const data = args.data as Record<string, unknown>;
    const dry_run = args.dry_run as boolean;
    // Check for unimplemented operations FIRST (before dry-run)
    // This ensures we don't claim we can preview operations that don't exist
    if (operation === 'bulk_update' || operation === 'bulk_delete') {
      throw new Error(`Bulk operations not yet implemented: ${operation}`);
    }
    if (dry_run) {
      return {
        dry_run: true,
        operation,
        appId,
        recordId,
        data,
        message: `DRY-RUN: Would execute ${operation} operation`,
      };
    }

    switch (operation) {
      case 'create':
        return this.client!.createRecord(appId, data);
      case 'update':
        return this.client!.updateRecord(appId, recordId, data);
      case 'delete':
        await this.client!.deleteRecord(appId, recordId);
        return { deleted: recordId };
      default:
        throw new Error(`Unknown record operation: ${String(operation)}`);
    }
  }

  private async handleSchema(args: Record<string, unknown>): Promise<unknown> {
    // SIMPLE scope: Schema operations
    const { appId } = args;
    return this.client!.getSchema(appId as string);
  }

  private handleUndo(_args: Record<string, unknown>): Promise<unknown> {
    // SIMPLE scope: Undo placeholder
    throw new Error('Undo functionality not yet implemented');
  }
}
