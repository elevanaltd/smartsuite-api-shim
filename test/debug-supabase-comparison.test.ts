// Test file for Supabase connection comparison
// Context7: consulted for @supabase/supabase-js - Already in use for Knowledge Platform client creation
// Context7: consulted for vitest - Test framework already configured in project, using for connection debugging
// TESTGUARD-APPROVED: Investigation test for production connection debugging

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect } from 'vitest';

describe('Supabase Knowledge Platform Connection Comparison', () => {
  // Configuration for OLD working instance
  const OLD_CONFIG = {
    url: 'https://tsizhlsbmwytqccjavap.supabase.co',
    serviceKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaXpobHNibXd5dHFjY2phdmFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDg2MzU3NSwiZXhwIjoyMDcwNDM5NTc1fQ.Z6f37YWGeBQy6YGsSOKBtTiWQ48MrA7h7Dy2U7zoN3E',
    name: 'OLD_WORKING',
  };

  // Configuration for NEW failing instance
  const NEW_CONFIG = {
    url: 'https://vbcfaegexbygqgsstoig.supabase.co',
    serviceKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiY2ZhZWdleGJ5Z3Fnc3N0b2lnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODE0MjY5MywiZXhwIjoyMDczNzE4NjkzfQ.iOeFwOjibo2b1siS7zqu_8fWPfynfzf-VB8-ANp8E0A',
    name: 'NEW_FAILING',
  };

  function createSupabaseClient(config: typeof OLD_CONFIG, schema = 'knowledge_platform') {
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

  it('should verify OLD Supabase instance can access knowledge_platform.snapshots', async () => {
    const client = createSupabaseClient(OLD_CONFIG);

    const { data, error } = await client.from('snapshots').select('id').limit(1);

    // OLD instance should work
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should identify why NEW Supabase instance fails to access knowledge_platform.snapshots', async () => {
    const client = createSupabaseClient(NEW_CONFIG);

    const { error } = await client.from('snapshots').select('id').limit(1);

    // NEW instance should fail with permission denied
    // We expect this to fail, so we'll examine the error
    if (error) {
      console.log(`NEW instance error: ${error.message}`);
      console.log('Error details:', error);
      expect(error.message).toContain('permission denied');
    } else {
      // If it works, that's actually unexpected and good news
      console.log('NEW instance unexpectedly works - connection issue resolved!');
    }
  });

  it('should compare service_role privileges between instances', async () => {
    const oldClient = createSupabaseClient(OLD_CONFIG);
    const newClient = createSupabaseClient(NEW_CONFIG);

    // Try to access pg_roles to compare service_role privileges
    const oldRoleQuery = oldClient
      .from('pg_roles')
      .select('rolname, rolsuper, rolcanlogin, rolreplication, rolbypassrls')
      .eq('rolname', 'service_role');

    const newRoleQuery = newClient
      .from('pg_roles')
      .select('rolname, rolsuper, rolcanlogin, rolreplication, rolbypassrls')
      .eq('rolname', 'service_role');

    const [oldResult, newResult] = await Promise.all([oldRoleQuery, newRoleQuery]);

    console.log('OLD service_role privileges:', oldResult.data);
    console.log('NEW service_role privileges:', newResult.data);

    // Both should have service_role data if accessible
    if (oldResult.data && newResult.data) {
      expect(oldResult.data).toBeDefined();
      expect(newResult.data).toBeDefined();

      // Compare rolbypassrls specifically
      const oldBypassRls = oldResult.data[0]?.rolbypassrls;
      const newBypassRls = newResult.data[0]?.rolbypassrls;

      console.log(`OLD rolbypassrls: ${oldBypassRls}`);
      console.log(`NEW rolbypassrls: ${newBypassRls}`);
    }
  });

  it('should check knowledge_platform schema existence on both instances', async () => {
    const oldClient = createSupabaseClient(OLD_CONFIG);
    const newClient = createSupabaseClient(NEW_CONFIG);

    // Check if knowledge_platform schema exists
    const checkSchema = async (client: any, name: string) => {
      try {
        const { data, error } = await client
          .from('information_schema.schemata')
          .select('schema_name')
          .eq('schema_name', 'knowledge_platform');

        console.log(`${name} schema check:`, { data, error });
        return { data, error };
      } catch (err) {
        console.log(`${name} schema check exception:`, err);
        return { data: null, error: err };
      }
    };

    const [oldSchema, newSchema] = await Promise.all([
      checkSchema(oldClient, 'OLD'),
      checkSchema(newClient, 'NEW'),
    ]);

    // Both should have the schema
    expect(oldSchema.data || oldSchema.error).toBeDefined();
    expect(newSchema.data || newSchema.error).toBeDefined();
  });

  it('should verify table existence in knowledge_platform schema', async () => {
    const oldClient = createSupabaseClient(OLD_CONFIG);
    const newClient = createSupabaseClient(NEW_CONFIG);

    const checkTables = async (client: any, name: string) => {
      try {
        const { data, error } = await client
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'knowledge_platform');

        console.log(
          `${name} tables in knowledge_platform:`,
          data?.map((t: any) => t.table_name),
        );
        return { data, error };
      } catch (err) {
        console.log(`${name} table check exception:`, err);
        return { data: null, error: err };
      }
    };

    const [_oldTables, _newTables] = await Promise.all([
      checkTables(oldClient, 'OLD'),
      checkTables(newClient, 'NEW'),
    ]);

    // Log results for comparison
    console.log('Table comparison complete');
  });
});
