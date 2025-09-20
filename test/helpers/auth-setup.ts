// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250919-blocked
/**
 * Test authentication setup using real API tokens
 * Technical-Architect: Real authentication over mocks for test reliability
 *
 * This module provides centralized authentication setup for tests,
 * mapping test tokens to standard environment variables and ensuring
 * consistent test configuration across all test files.
 */
// Context7: consulted for vitest
import { describe, it } from 'vitest';

/**
 * Set up test authentication by mapping test tokens to standard env vars
 * This allows CI to use test tokens while keeping production tokens separate
 */
export function setupTestAuthentication(): void {
  // Map test tokens to standard env vars for CI
  if (process.env.SMARTSUITE_API_TOKEN_TEST) {
    process.env.SMARTSUITE_API_TOKEN = process.env.SMARTSUITE_API_TOKEN_TEST;
    console.log('Using TEST API token from SMARTSUITE_API_TOKEN_TEST');
  }

  if (process.env.SMARTSUITE_WORKSPACE_ID_TEST) {
    process.env.SMARTSUITE_WORKSPACE_ID = process.env.SMARTSUITE_WORKSPACE_ID_TEST;
    console.log('Using TEST workspace from SMARTSUITE_WORKSPACE_ID_TEST');
  }

  // Default to test workspace if not set
  if (!process.env.SMARTSUITE_WORKSPACE_ID) {
    process.env.SMARTSUITE_WORKSPACE_ID = 's3qnmox1';
    console.log('Using default TEST workspace: s3qnmox1');
  }

  // TESTGUARD: Removed TEST_MODE - tests must use production configuration (2 tools)

  // Use test table by default for safety
  process.env.DEFAULT_TABLE_ID = '68ab34b30b1e05e11a8ba87f'; // Test table (safe playground)
}

/**
 * Check if real authentication credentials are available
 * This helps tests decide whether to run with real API or skip
 */
export function isRealAuthAvailable(): boolean {
  return !!(
    process.env.SMARTSUITE_API_TOKEN ||
    process.env.SMARTSUITE_API_TOKEN_TEST ||
    // Check .env.local for local development
    process.env.VITE_SMARTSUITE_API_TOKEN
  );
}

/**
 * Get a descriptive message about the current auth configuration
 */
export function getAuthConfigDescription(): string {
  if (process.env.SMARTSUITE_API_TOKEN_TEST) {
    return 'REAL authentication (test token from CI/CD)';
  }
  if (process.env.SMARTSUITE_API_TOKEN) {
    return 'REAL authentication (standard token)';
  }
  if (process.env.VITE_SMARTSUITE_API_TOKEN) {
    return 'REAL authentication (local development)';
  }
  return 'NO authentication (tests requiring API will be skipped)';
}

/**
 * Helper to skip tests when real auth is not available
 * Usage: describeWithAuth('My API tests', () => { ... })
 */
export function describeWithAuth(name: string, fn: () => void): void {
  if (isRealAuthAvailable()) {
    describe(name, fn);
  } else {
    describe.skip(`${name} (skipped - no API credentials)`, fn);
  }
}

/**
 * Helper for individual test skipping
 * Usage: itWithAuth('should call API', async () => { ... })
 */
export function itWithAuth(name: string, fn: () => void | Promise<void>): void {
  if (isRealAuthAvailable()) {
    it(name, fn);
  } else {
    it.skip(`${name} (skipped - no API credentials)`, fn);
  }
}
