// TESTGUARD_BYPASS: TDD-GREEN-001 - Minimal implementation to pass failing test committed in 8272d0f
// Context7: consulted for @modelcontextprotocol/sdk (will be added when needed)
// Critical-Engineer: consulted for Architecture pattern selection
export class SmartSuiteShimServer {
  constructor() {
    // Minimal implementation to make instantiation test pass
  }

  getTools(): Array<{name: string; inputSchema: {properties: Record<string, unknown>}}> {
    // Minimal implementation to satisfy the 4 CQRS tools test
    return [
      {
        name: 'smartsuite_query',
        inputSchema: {
          properties: {
            operation: {
              enum: ['list', 'get', 'search', 'count'],
            },
          },
        },
      },
      {
        name: 'smartsuite_record',
        inputSchema: {
          properties: {
            operation: {
              enum: ['create', 'update', 'delete', 'bulk_update', 'bulk_delete'],
            },
            dry_run: {
              default: true,
            },
          },
        },
      },
      {
        name: 'smartsuite_schema',
        inputSchema: {
          properties: {},
        },
      },
      {
        name: 'smartsuite_undo',
        inputSchema: {
          properties: {},
        },
      },
    ];
  }
}
