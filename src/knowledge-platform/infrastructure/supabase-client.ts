// Supabase client configuration for Knowledge Platform
// TECHNICAL-ARCHITECT: Isolated client with connection pooling

import { resolve } from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load Knowledge Platform specific environment
dotenv.config({ path: resolve('.env.knowledge.local') });

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
