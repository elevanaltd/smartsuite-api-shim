// Context7: consulted for vitest
// Context7: consulted for fs
import * as fs from 'fs';
// Context7: consulted for path
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs and path modules
vi.mock('fs');
vi.mock('path');

// We'll import the functions to test after they're implemented
describe('Path Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveKnowledgePath', () => {
    it('should resolve knowledge path for production builds', async () => {
      // Mock production environment - build/src structure
      const mockImportUrl = 'file:///app/build/src/mcp-server.js';
      const mockCurrentDir = '/app/build/src';

      vi.mocked(path.dirname).mockReturnValue(mockCurrentDir);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'));

      // This will fail until we implement resolveKnowledgePath
      const { resolveKnowledgePath } = await import('./path-resolver.js');

      const result = resolveKnowledgePath(mockImportUrl);
      expect(result).toBe('/app/build/src/knowledge');
    });

    it('should resolve knowledge path for development environment', async () => {
      // Mock development environment - src structure
      const mockImportUrl = 'file:///project/src/mcp-server.js';
      const mockCurrentDir = '/project/src';

      vi.mocked(path.dirname).mockReturnValue(mockCurrentDir);
      // Mock package.json exists at project root
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        return pathStr.includes('package.json') || pathStr.includes('src/knowledge');
      });
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
      vi.mocked(path.dirname).mockImplementation((p) => {
        const parts = String(p).split('/');
        parts.pop();
        return parts.join('/');
      });

      const { resolveKnowledgePath } = await import('./path-resolver.js');

      const result = resolveKnowledgePath(mockImportUrl);
      expect(result).toContain('src/knowledge');
    });

    it('should handle fallback when knowledge directory not found', async () => {
      const mockImportUrl = 'file:///app/build/src/mcp-server.js';

      vi.mocked(path.dirname).mockReturnValue('/app/build/src');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(path.resolve).mockReturnValue('/app/build/src/../knowledge');

      const { resolveKnowledgePath } = await import('./path-resolver.js');

      const result = resolveKnowledgePath(mockImportUrl);
      expect(result).toBeDefined();
    });
  });

  describe('isProductionEnvironment', () => {
    it('should detect production from NODE_ENV', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const { isProductionEnvironment } = await import('./path-resolver.js');
        const result = isProductionEnvironment();
        expect(result).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should detect production from stack trace build path', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Mock Error to return stack trace with build path
      const mockError = {
        stack: 'Error: test\n    at /app/build/src/file.js:10:5',
      };
      vi.spyOn(global, 'Error').mockImplementationOnce(() => mockError as Error);

      try {
        const { isProductionEnvironment } = await import('./path-resolver.js');
        const result = isProductionEnvironment();
        expect(result).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
        vi.restoreAllMocks();
      }
    });

    it('should detect development environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Mock Error to return stack trace without build path
      const mockError = {
        stack: 'Error: test\n    at /project/src/file.js:10:5',
      };
      vi.spyOn(global, 'Error').mockImplementationOnce(() => mockError as Error);

      try {
        const { isProductionEnvironment } = await import('./path-resolver.js');
        const result = isProductionEnvironment();
        expect(result).toBe(false);
      } finally {
        process.env.NODE_ENV = originalEnv;
        vi.restoreAllMocks();
      }
    });
  });

  describe('resolveAssetPath', () => {
    it('should resolve asset path for production environment', async () => {
      const mockImportUrl = 'file:///app/build/src/module.js';
      const mockCurrentDir = '/app/build/src/intelligent';

      vi.mocked(path.dirname).mockReturnValue(mockCurrentDir);
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'));

      const { resolveAssetPath } = await import('./path-resolver.js');

      const result = resolveAssetPath('knowledge/api-patterns.json', mockImportUrl);
      expect(result).toBe('/app/build/src/knowledge/api-patterns.json');
    });

    it('should resolve asset path for development environment', async () => {
      // Mock fileURLToPath within the test
      const { fileURLToPath } = await import('url');
      vi.mocked(fileURLToPath).mockReturnValue('/project/src/intelligent/module.js');

      const mockImportUrl = 'file:///project/src/intelligent/module.js';
      const mockCurrentDir = '/project/src/intelligent';

      vi.mocked(path.dirname).mockReturnValue(mockCurrentDir);
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        // Return true when we check for the src directory existing at /project/src
        return pathStr === '/project/src';
      });
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
      vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));

      const { resolveAssetPath } = await import('./path-resolver.js');

      const result = resolveAssetPath('knowledge/api-patterns.json', mockImportUrl);
      // Since we're in /project/src/intelligent and we find /project/src exists,
      // it should return /project/src/knowledge/api-patterns.json
      expect(result).toBe('/project/src/knowledge/api-patterns.json');
    });
  });
});
