// Integration test environment setup
// Critical-Engineer: consulted for test environment configuration and mocking strategy
// Technical-Architect: Replaced mocks with real authentication
// Context7: consulted for dotenv
// Context7: consulted for path
// CONTEXT7_BYPASS: CI-FIX-001 - Emergency import order fix for CI pipeline

// Load environment variables for integration tests that need real connections
import path from 'path';

import { config } from 'dotenv';

import { setupTestAuthentication, getAuthConfigDescription } from './helpers/auth-setup.js';
import { setupCIMockAuthentication } from './helpers/ci-auth-mock.js';

// Setup CI mock if in CI environment
setupCIMockAuthentication();

// Determine which env file to load based on environment
// Updated to use .env.local as per security requirements
const envFile = process.env.CI ? '.env.ci' : '.env.local';
const envPath = path.resolve(process.cwd(), envFile);

// Load the environment file
config({ path: envPath });

// Set up test authentication (maps TEST tokens to standard vars)
setupTestAuthentication();

// Verify critical environment variables are loaded for integration tests
const requiredVars = [
  'KNOWLEDGE_SUPABASE_URL',
  'KNOWLEDGE_SUPABASE_SERVICE_KEY',
  'KNOWLEDGE_DB_SCHEMA',
];

// In CI, these might be dummy values, which is OK for build validation
// In local dev, these should be real values for integration testing
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.warn(`Warning: Missing environment variable ${varName} for integration tests`);
  }
}

console.log(`Integration test environment loaded from: ${envPath}`);
console.log(`Authentication mode: ${getAuthConfigDescription()}`);
console.log('Production mode: 2 tools (intelligent facade + undo)');
