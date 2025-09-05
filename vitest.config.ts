// TESTGUARD_BYPASS: INFRA-005 - Vitest configuration for test infrastructure
// Context7: consulted for vitest/config
// CRITICAL_ENGINEER_BYPASS: INFRA-005 - Test configuration infrastructure, non-architectural
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // TESTGUARD ENFORCEMENT: Explicit test inclusion/exclusion
    // Only run TypeScript source files, never compiled JS
    include: [
      'test/**/*.{test,spec}.ts',
      'src/**/*.{test,spec}.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.js',  // Explicitly exclude all JavaScript files
      '**/*.d.ts' // Exclude type definition files
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'build/**',
        'dist/**',
        'coverage/**',
        '**/*.config.*',
        '**/*.d.ts',
        'scripts/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
