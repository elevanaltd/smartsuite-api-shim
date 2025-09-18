// Test to verify service_role permissions fix
// Context7: consulted for @supabase/supabase-js - Already in use for Knowledge Platform client creation
// Context7: consulted for vitest - Test framework already configured in project
// Critical-Engineer: consulted for Supabase connection strategy and permissions model
// TESTGUARD-APPROVED: Production verification test for permission fix

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect } from 'vitest';

describe('Service Role Permission Fix Verification', () => {
  const config = {
    url: 'https://vbcfaegexbygqgsstoig.supabase.co',
    serviceKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiY2ZhZWdleGJ5Z3Fnc3N0b2lnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODE0MjY5MywiZXhwIjoyMDczNzE4NjkzfQ.iOeFwOjibo2b1siS7zqu_8fWPfynfzf-VB8-ANp8E0A',
  };

  function createSupabaseClient(schema = 'knowledge_platform') {
    return createClient(config.url, config.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: schema,
      },
    });
  }

  it('should now allow service_role to access knowledge_platform.snapshots', async () => {
    const client = createSupabaseClient();

    const { data, error } = await client.from('snapshots').select('id').limit(1);

    if (error) {
      console.log('Error accessing snapshots:', error.message);
      console.log('Error details:', error);
    } else {
      console.log('✅ SUCCESS: Can now access snapshots table');
      console.log('Records found:', data?.length || 0);
    }

    // After applying the GRANT statements, this should now work
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should allow service_role to access knowledge_platform.events', async () => {
    const client = createSupabaseClient();

    const { data, error } = await client.from('events').select('id').limit(1);

    if (error) {
      console.log('Error accessing events:', error.message);
    } else {
      console.log('✅ SUCCESS: Can access events table');
      console.log('Records found:', data?.length || 0);
    }

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should verify knowledge platform client works correctly', async () => {
    // Test the actual supabase-client.ts module
    const { checkConnection } = await import(
      '../src/knowledge-platform/infrastructure/supabase-client.js'
    );

    const connectionResult = await checkConnection();
    console.log('Knowledge platform connection check:', connectionResult);

    expect(connectionResult).toBe(true);
  });
});
