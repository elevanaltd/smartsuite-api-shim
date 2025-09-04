// Context7: consulted for vitest
// Test for index.ts entry point  
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SmartSuiteShimServer as ServerType } from '../src/mcp-server';

describe('index.ts entry point', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  
  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit called with code ${code}`);
    });
    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MCP_VALIDATE_AND_EXIT;
    vi.resetModules();
  });
  
  it('should export SmartSuiteShimServer class and main function', async () => {
    const indexModule = await import('../src/index');
    expect(indexModule.SmartSuiteShimServer).toBeDefined();
    expect(indexModule.main).toBeDefined();
    expect(typeof indexModule.main).toBe('function');
  });
  
  it('should initialize server and log available tools when main() runs', async () => {
    const { main } = await import('../src/index');
    
    // Set validation mode to exit cleanly
    process.env.MCP_VALIDATE_AND_EXIT = 'true';
    
    await expect(main()).rejects.toThrow('process.exit called with code 0');
    
    // Verify startup logs include tool information
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('SmartSuite API Shim MCP Server starting')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Server initialized with 4 tools:',
      ['smartsuite_query', 'smartsuite_record', 'smartsuite_schema', 'smartsuite_undo']
    );
  });
  
  it('should exit cleanly in validation mode after startup validation', async () => {
    process.env.MCP_VALIDATE_AND_EXIT = 'true';
    const { main } = await import('../src/index');
    
    await expect(main()).rejects.toThrow('process.exit called with code 0');
    
    // Verify validation mode behavior
    expect(consoleLogSpy).toHaveBeenCalledWith('CI startup validation successful');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
  
  it('should handle startup errors gracefully', async () => {
    // Mock the server to throw an error
    vi.doMock('../src/mcp-server', () => ({
      SmartSuiteShimServer: vi.fn().mockImplementation(() => {
        throw new Error('Initialization failed');
      })
    }));
    
    const { main } = await import('../src/index');
    
    await expect(main()).rejects.toThrow('process.exit called with code 1');
    
    // Verify error handling
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to start server:',
      expect.any(Error)
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
    
    vi.doUnmock('../src/mcp-server');
  });
});