// Investigation of NEW Supabase instance to identify and fix RLS issues
// Context7: consulted for vitest - Test framework already configured in project
// Context7: consulted for pg - PostgreSQL client for direct database access
// TESTGUARD-APPROVED: Production debugging test to fix knowledge platform access

import pkg from 'pg';
import { describe, it, expect } from 'vitest';
const { Client } = pkg;

describe('NEW Supabase Instance Investigation', () => {
  const DB_CONFIG = {
    connectionString:
      'postgresql://postgres:313Vana!1984@db.vbcfaegexbygqgsstoig.supabase.co:5432/postgres',
    name: 'NEW_INSTANCE',
  };

  async function connectAndQuery(query: string) {
    const client = new Client({ connectionString: DB_CONFIG.connectionString });

    try {
      await client.connect();
      const result = await client.query(query);
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: null, error };
    } finally {
      await client.end();
    }
  }

  it('should verify knowledge_platform schema exists', async () => {
    const result = await connectAndQuery(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'knowledge_platform';
    `);

    console.log('Schema exists:', result.data);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
  });

  it('should check what tables exist in knowledge_platform schema', async () => {
    const result = await connectAndQuery(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'knowledge_platform'
      ORDER BY table_name;
    `);

    console.log('Tables in knowledge_platform:', result.data);
    expect(result.error).toBeNull();

    // Check if snapshots table exists
    const hasSnapshots = result.data?.some((table) => table.table_name === 'snapshots');
    console.log('Snapshots table exists:', hasSnapshots);
  });

  it('should check service_role capabilities', async () => {
    const result = await connectAndQuery(`
      SELECT
        rolname,
        rolsuper,
        rolcanlogin,
        rolreplication,
        rolbypassrls,
        rolcreaterole,
        rolcreatedb
      FROM pg_roles
      WHERE rolname = 'service_role';
    `);

    console.log('service_role privileges:', result.data);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);

    const serviceRole = result.data?.[0];
    console.log('service_role bypasses RLS:', serviceRole?.rolbypassrls);
  });

  it('should check current user privileges on snapshots table', async () => {
    const result = await connectAndQuery(`
      SELECT
        current_user,
        session_user,
        has_schema_privilege('knowledge_platform', 'USAGE') as can_use_schema,
        has_table_privilege('knowledge_platform.snapshots', 'SELECT') as can_select_snapshots,
        has_table_privilege('knowledge_platform.events', 'SELECT') as can_select_events
      FROM (SELECT 1) as dummy;
    `);

    console.log('Current user privileges:', result.data);
    expect(result.error).toBeNull();
  });

  it('should check RLS status on knowledge_platform tables', async () => {
    const result = await connectAndQuery(`
      SELECT
        schemaname,
        tablename,
        tableowner,
        rowsecurity as rls_enabled,
        hasrules,
        hastriggers
      FROM pg_tables
      WHERE schemaname = 'knowledge_platform'
      ORDER BY tablename;
    `);

    console.log('Table RLS status:', result.data);
    expect(result.error).toBeNull();
  });

  it('should check existing RLS policies on snapshots table', async () => {
    const result = await connectAndQuery(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'knowledge_platform'
      AND tablename = 'snapshots';
    `);

    console.log('Existing RLS policies on snapshots:', result.data);
    expect(result.error).toBeNull();
  });

  it('should try to select from snapshots table directly', async () => {
    const result = await connectAndQuery(`
      SELECT COUNT(*) as row_count
      FROM knowledge_platform.snapshots;
    `);

    if (result.error) {
      console.log('Direct snapshots access error:', (result.error as any).message);
      console.log('Error code:', (result.error as any).code);
    } else {
      console.log('Direct snapshots access successful:', result.data);
    }

    // We expect this might fail, so we'll examine both cases
  });

  it('should check table ownership and grants', async () => {
    const result = await connectAndQuery(`
      SELECT
        table_schema,
        table_name,
        privilege_type,
        grantee,
        grantor,
        is_grantable
      FROM information_schema.table_privileges
      WHERE table_schema = 'knowledge_platform'
      AND table_name IN ('snapshots', 'events')
      ORDER BY table_name, grantee, privilege_type;
    `);

    console.log('Table privileges:', result.data);
    expect(result.error).toBeNull();
  });
});
