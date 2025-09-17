// RED PHASE: Test that validates the validation integration bug
// This test WILL FAIL until validated arguments are properly used in mcp-server.ts
// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock tool handlers before importing the server
vi.mock('../src/tools/query.js', () => ({
  handleQuery: vi.fn(),
}));

vi.mock('../src/tools/record.js', () => ({
  handleRecord: vi.fn(),
}));

vi.mock('../src/tools/schema.js', () => ({
  handleSchema: vi.fn(),
}));

// Mock other tools that might be called
vi.mock('../src/tools/discover.js', () => ({
  handleDiscover: vi.fn(),
}));

vi.mock('../src/tools/undo.js', () => ({
  handleUndo: vi.fn(),
}));

vi.mock('../src/tools/intelligent.js', () => ({
  handleIntelligent: vi.fn(),
}));

// Mock the createAuthenticatedClient to avoid real API calls
vi.mock('../src/smartsuite-client.js', () => ({
  createAuthenticatedClient: vi.fn(async (config) => {
    if (config.apiKey === 'test-api-token') {
      return {
        apiKey: config.apiKey,
        workspaceId: config.workspaceId,
        getSchema: vi.fn().mockResolvedValue({
          id: 'test-app-id',
          name: 'Test Application',
          structure: [],
        }),
        get: vi.fn().mockResolvedValue({ fields: [] }),
      };
    }
    throw new Error('Invalid API credentials');
  }),
  SmartSuiteClient: vi.fn(),
  SmartSuiteClientConfig: {},
}));

// Mock validation to intercept and transform arguments
vi.mock('../src/validation/input-validator.js', () => ({
  validateMcpToolInput: vi.fn(),
  McpValidationError: class McpValidationError extends Error {
    constructor(message, toolName, validationErrors) {
      super(message);
      this.toolName = toolName;
      this.validationErrors = validationErrors;
      this.name = 'McpValidationError';
    }
  },
}));

// Now import the server after mocks are set up
import { SmartSuiteShimServer } from '../src/mcp-server.js';
import { handleQuery } from '../src/tools/query.js';
import { handleRecord } from '../src/tools/record.js';
import { handleSchema } from '../src/tools/schema.js';
import { validateMcpToolInput } from '../src/validation/input-validator.js';

// Get references to the mocked functions
const mockHandleQuery = vi.mocked(handleQuery);
const mockHandleRecord = vi.mocked(handleRecord);
const mockHandleSchema = vi.mocked(handleSchema);
const mockValidateToolInput = vi.mocked(validateMcpToolInput);

describe('Validation Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment for authentication
    process.env.SMARTSUITE_API_TOKEN = 'test-api-token';
    process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';
  });

  describe('Validation pipeline integration', () => {
    it('FAILS: should pass validated arguments to tool handlers, not original args', async () => {
      // ARRANGE: Create server and initialize
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // Mock the query handler to capture arguments
      mockHandleQuery.mockResolvedValue({ success: true });

      // Set up validation mock to return transformed arguments
      const originalArgs = {
        operation: 'list',
        appId: 'test-app-id',
        limit: 10,
        offset: 0,
      };

      const validatedArgs = {
        operation: 'list',
        appId: 'test-app-id',
        limit: 10,
        offset: 0,
        // Add marker to identify validated args
        __validated: true,
      };

      mockValidateToolInput.mockReturnValue(validatedArgs);

      // ACT: Execute tool
      await server.executeTool('smartsuite_query', originalArgs);

      // ASSERT: Validation should have been called
      expect(mockValidateToolInput).toHaveBeenCalledWith(
        'smartsuite_query',
        expect.any(Object), // schema
        originalArgs
      );

      // ASSERT: Handler should receive VALIDATED arguments, not original
      expect(mockHandleQuery).toHaveBeenCalledTimes(1);
      const [context, receivedArgs] = mockHandleQuery.mock.calls[0];

      // This test WILL FAIL because current implementation passes original args
      // The handler should receive the validated args with the __validated marker
      expect(receivedArgs).toHaveProperty('__validated', true);
      expect(receivedArgs).toBe(validatedArgs); // Should be the exact validated object
      expect(receivedArgs).not.toBe(originalArgs); // Should NOT be the original object
    });

    it('FAILS: should pass validated arguments to record handler with transformations', async () => {
      // ARRANGE: Create server and initialize
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // Mock the record handler to capture arguments
      mockHandleRecord.mockResolvedValue({ success: true });

      // Set up validation mock to return transformed arguments
      const originalArgs = {
        operation: 'create',
        appId: 'test-app-id',
        dry_run: true,
        data: { field1: 'value1' },
      };

      const validatedArgs = {
        operation: 'create',
        appId: 'test-app-id',
        dry_run: true,
        data: { field1: 'value1' },
        // Add marker to identify validated args and simulated transformation
        __validated: true,
        __transformed_field: 'validation_pipeline_processed',
      };

      mockValidateToolInput.mockReturnValue(validatedArgs);

      // ACT: Execute tool
      await server.executeTool('smartsuite_record', originalArgs);

      // ASSERT: Validation should have been called
      expect(mockValidateToolInput).toHaveBeenCalledWith(
        'smartsuite_record',
        expect.any(Object), // schema
        originalArgs
      );

      // ASSERT: Handler should receive VALIDATED arguments with transformations
      expect(mockHandleRecord).toHaveBeenCalledTimes(1);
      const [context, receivedArgs] = mockHandleRecord.mock.calls[0];

      // This test WILL FAIL because current implementation passes original args
      expect(receivedArgs).toHaveProperty('__validated', true);
      expect(receivedArgs).toHaveProperty('__transformed_field', 'validation_pipeline_processed');
      expect(receivedArgs).toBe(validatedArgs); // Should be the exact validated object
      expect(receivedArgs).not.toBe(originalArgs); // Should NOT be the original object
    });

    it('FAILS: validation pipeline should be invoked for all tools with schemas', async () => {
      // ARRANGE: Create server and initialize
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // Mock the schema handler to capture arguments
      mockHandleSchema.mockResolvedValue({ success: true });

      // Set up validation mock to return identical but marked arguments
      const originalArgs = {
        appId: 'test-app-id',
        output_mode: 'summary',
      };

      const validatedArgs = {
        ...originalArgs,
        __validated: true,
      };

      mockValidateToolInput.mockReturnValue(validatedArgs);

      // ACT: Execute tool
      await server.executeTool('smartsuite_schema', originalArgs);

      // ASSERT: Validation pipeline should have been invoked
      expect(mockValidateToolInput).toHaveBeenCalledWith(
        'smartsuite_schema',
        expect.any(Object), // schema
        originalArgs
      );

      // ASSERT: Handler should receive validated args (architectural requirement)
      expect(mockHandleSchema).toHaveBeenCalledTimes(1);
      const [context, receivedArgs] = mockHandleSchema.mock.calls[0];

      // This test WILL FAIL because current implementation ignores validation result
      expect(receivedArgs).toHaveProperty('__validated', true);
      expect(receivedArgs).toBe(validatedArgs); // Should be validation result
      expect(receivedArgs).not.toBe(originalArgs); // Should NOT bypass validation
    });
  });
});