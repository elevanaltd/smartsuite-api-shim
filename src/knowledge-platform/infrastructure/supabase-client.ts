// Supabase client configuration for Knowledge Platform
// TECHNICAL-ARCHITECT: Isolated client with connection pooling
// CONTEXT7_BYPASS: CRITICAL-PATH-FIX - Server fails when run from different CWD
// Context7: consulted for path - Node.js built-in module for path operations
// Context7: consulted for url - Node.js built-in module for URL/file path conversion
// Context7: consulted for @supabase/supabase-js - Already in use, maintaining existing pattern
// Context7: consulted for dotenv - Already in use, maintaining existing pattern

import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Get the directory of this module file to make path resolution CWD-independent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Knowledge Platform specific environment - relative to project root
// Goes up 3 levels from src/knowledge-platform/infrastructure/ to project root
const envPath = join(__dirname, '..', '..', '..', '.env.knowledge.local');
dotenv.config({ path: resolve(envPath) });

// Validate required environment variables
const requiredEnvVars = [
  'KNOWLEDGE_SUPABASE_URL',
  'KNOWLEDGE_SUPABASE_SERVICE_KEY',
  'KNOWLEDGE_DB_SCHEMA',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Create Supabase client with service role for backend operations
export const supabase = createClient(
  process.env.KNOWLEDGE_SUPABASE_URL!,
  process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: process.env.KNOWLEDGE_DB_SCHEMA || 'knowledge_platform',
    },
  },
);

// Export configuration for use in other modules
export const knowledgeConfig = {
  schema: process.env.KNOWLEDGE_DB_SCHEMA || 'knowledge_platform',
  maxRetries: parseInt(process.env.KNOWLEDGE_MAX_RETRIES || '3'),
  retryDelayMs: parseInt(process.env.KNOWLEDGE_RETRY_DELAY_MS || '1000'),
  snapshotInterval: parseInt(process.env.KNOWLEDGE_SNAPSHOT_INTERVAL || '100'),
  maxEventsPerQuery: parseInt(process.env.KNOWLEDGE_MAX_EVENTS_PER_QUERY || '1000'),
};

// Connection health check
export async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('events')
      .select('id')
      .limit(1);

    return !error || error.code === 'PGRST116'; // No rows is OK
  } catch (_error) {
    // console.error('Supabase connection check failed:', error);
    return false;
  }
}
