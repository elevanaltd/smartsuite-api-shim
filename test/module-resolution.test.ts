// Test to validate module resolution for ES modules in Node.js
// Critical-Engineer: consulted for Node.js ESM module resolution strategy
// Context7: consulted for vitest
// Context7: consulted for child_process
// Context7: consulted for util
// Context7: consulted for fs/promises
// Context7: consulted for path
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const execAsync = promisify(exec);

describe('ES Module Resolution', () => {
  const buildDir = path.join(process.cwd(), 'build');
  const testBuildDir = path.join(process.cwd(), 'test-build');

  beforeAll(async () => {
    // Clean up any previous test build
    await fs.rm(testBuildDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    // Clean up test build directory
    await fs.rm(testBuildDir, { recursive: true, force: true });
  });

  it('should compile TypeScript with proper .js extensions for Node.js ES modules', async () => {
    // Create a test TypeScript file with import
    const testSrcDir = path.join(testBuildDir, 'src');
    await fs.mkdir(testSrcDir, { recursive: true });

    // Create a module to import
    const moduleContent = `export const testValue = 'ES Module Test';
export class TestClass {
  getValue() { return testValue; }
}`;
    await fs.writeFile(path.join(testSrcDir, 'test-module.ts'), moduleContent);

    // Create main file with .js extension import (correct ES module syntax)
    const mainContent = `import { testValue, TestClass } from './test-module.js';
console.log(testValue);
const instance = new TestClass();
console.log(instance.getValue());`;
    await fs.writeFile(path.join(testSrcDir, 'test-main.ts'), mainContent);

    // Create a minimal tsconfig for the test - using NodeNext
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'nodenext',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src/**/*'],
    };
    await fs.writeFile(
      path.join(testBuildDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2),
    );

    // Create package.json with type: module
    const packageJson = {
      name: 'test-es-modules',
      type: 'module',
    };
    await fs.writeFile(
      path.join(testBuildDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    // Compile the TypeScript
    const { stdout: tscOutput, stderr: tscError } = await execAsync(
      `cd ${testBuildDir} && npx tsc`,
    );

    // TypeScript should compile successfully
    expect(tscError).toBe('');

    // Check that the compiled JavaScript has the .js extension
    const compiledMain = await fs.readFile(
      path.join(testBuildDir, 'dist', 'test-main.js'),
      'utf-8',
    );
    expect(compiledMain).toContain("from './test-module.js'");

    // Test that Node.js can actually run the compiled code
    const { stdout: nodeOutput, stderr: nodeError } = await execAsync(
      `cd ${testBuildDir} && node dist/test-main.js`,
    );

    // Node.js should run without module resolution errors
    expect(nodeError).toBe('');
    expect(nodeOutput).toContain('ES Module Test');
  });

  it('should fail to run when .js extensions are missing in compiled output', async () => {
    // This test demonstrates the problem we're fixing
    const testSrcDir = path.join(testBuildDir, 'src-bad');
    await fs.mkdir(testSrcDir, { recursive: true });

    // Create module
    const moduleContent = 'export const badValue = \'This will fail\';';
    await fs.writeFile(path.join(testSrcDir, 'bad-module.ts'), moduleContent);

    // Create main file WITHOUT .js extension (incorrect for ES modules)
    const mainContent = `import { badValue } from './bad-module';
console.log(badValue);`;
    await fs.writeFile(path.join(testSrcDir, 'bad-main.ts'), mainContent);

    // Create tsconfig with old "node" resolution
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'node', // Old setting that doesn't enforce .js
        outDir: './dist-bad',
        rootDir: './src-bad',
        strict: true,
      },
      include: ['src-bad/**/*'],
    };
    await fs.writeFile(
      path.join(testBuildDir, 'tsconfig-bad.json'),
      JSON.stringify(tsconfig, null, 2),
    );

    // Compile with the bad config
    await execAsync(
      `cd ${testBuildDir} && npx tsc -p tsconfig-bad.json`,
    );

    // Try to run the compiled code - it should fail
    try {
      await execAsync(
        `cd ${testBuildDir} && node dist-bad/bad-main.js`,
      );
      // If we get here, the test failed - it should have thrown
      expect(true).toBe(false);
    } catch (error: any) {
      // Expected error - Node.js can't find the module without .js
      expect(error.message).toContain('ERR_MODULE_NOT_FOUND');
      expect(error.message).toContain('bad-module');
    }
  });

  it('should validate build output can be executed by Node.js', async () => {
    // Test the actual build output
    const { stderr } = await execAsync(
      'MCP_VALIDATE_AND_EXIT=true node build/index.js',
      { cwd: process.cwd() },
    );

    // Should run without module resolution errors
    expect(stderr).not.toContain('ERR_MODULE_NOT_FOUND');
  });
});
