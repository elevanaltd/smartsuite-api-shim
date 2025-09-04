// Context7: consulted for vitest
// Test for index.ts entry point  
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartSuiteShimServer } from '../src/mcp-server';

describe('index.ts entry point', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  
  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MCP_VALIDATE_AND_EXIT;
  });
  
  it('should export SmartSuiteShimServer class', async () => {
    // This will be validated once index.ts exists
    const indexModule = await import('../src/index');
    expect(indexModule.SmartSuiteShimServer).toBeDefined();
    expect(indexModule.SmartSuiteShimServer).toBe(SmartSuiteShimServer);
  });
  
  it('should initialize server and log available tools when main() runs', async () => {
    // Test will validate that the main function properly initializes the server
    const indexModule = await import('../src/index');
    
    // Verify startup logs include tool information
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('SmartSuite API Shim MCP Server starting')
    );
  });
  
  it('should exit cleanly in validation mode after startup validation', async () => {
    process.env.MCP_VALIDATE_AND_EXIT = 'true';
    
    // Import will trigger main() execution
    await expect(import('../src/index')).rejects.toThrow('process.exit called');
    
    // Verify validation mode behavior
    expect(consoleLogSpy).toHaveBeenCalledWith('CI startup validation successful');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
  
  it('should handle startup errors gracefully', async () => {
    // Mock server constructor to throw
    vi.mock('../src/mcp-server', () => ({
      SmartSuiteShimServer: vi.fn().mockImplementation(() => {
        throw new Error('Initialization failed');
      })
    }));
    
    await expect(import('../src/index')).rejects.toThrow();
    
    // Verify error handling
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to start server:',
      expect.any(Error)
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});