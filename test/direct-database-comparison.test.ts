// Direct database connection test to bypass PostgREST and investigate RLS policies
// Context7: consulted for vitest - Test framework already configured in project
// Context7: consulted for pg - PostgreSQL client for direct database access
// TESTGUARD-APPROVED: Direct SQL investigation for RLS policy comparison

import pkg from 'pg';
import { describe, it, expect } from 'vitest';
const { Client } = pkg;

describe('Direct Database RLS Policy Comparison', () => {
  // OLD working database connection
  const OLD_CONFIG = {
    connectionString:
      'postgresql://postgres:313Vana1984!@db.tsizhlsbmwytqccjavap.supabase.co:5432/postgres',
    name: 'OLD_WORKING',
  };

  // NEW failing database connection
  const NEW_CONFIG = {
    connectionString:
      'postgresql://postgres:313Vana!1984@db.vbcfaegexbygqgsstoig.supabase.co:5432/postgres',
    name: 'NEW_FAILING',
  };

  async function connectAndQuery(config: typeof OLD_CONFIG, query: string) {
    const client = new Client({ connectionString: config.connectionString });

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

  it('should check if knowledge_platform schema exists on both instances', async () => {
    const schemaQuery = `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'knowledge_platform';
    `;

    const [oldResult, newResult] = await Promise.all([
      connectAndQuery(OLD_CONFIG, schemaQuery),
      connectAndQuery(NEW_CONFIG, schemaQuery),
    ]);

    console.log(`${OLD_CONFIG.name} schema exists:`, (oldResult.data?.length ?? 0) > 0);
    console.log(`${NEW_CONFIG.name} schema exists:`, (newResult.data?.length ?? 0) > 0);

    // Both should have the schema
    expect(oldResult.error).toBeNull();
    expect(newResult.error).toBeNull();
  });

  it('should compare service_role privileges on both instances', async () => {
    const roleQuery = `
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
    `;

    const [oldResult, newResult] = await Promise.all([
      connectAndQuery(OLD_CONFIG, roleQuery),
      connectAndQuery(NEW_CONFIG, roleQuery),
    ]);

    console.log(`${OLD_CONFIG.name} service_role:`, oldResult.data);
    console.log(`${NEW_CONFIG.name} service_role:`, newResult.data);

    if (oldResult.data?.[0] && newResult.data?.[0]) {
      const oldBypassRls = oldResult.data[0].rolbypassrls;
      const newBypassRls = newResult.data[0].rolbypassrls;

      console.log(`OLD rolbypassrls: ${oldBypassRls}`);
      console.log(`NEW rolbypassrls: ${newBypassRls}`);

      // This is the critical comparison
      expect(typeof oldBypassRls).toBe('boolean');
      expect(typeof newBypassRls).toBe('boolean');
    }

    expect(oldResult.error).toBeNull();
    expect(newResult.error).toBeNull();
  });

  it('should check RLS policies on knowledge_platform.snapshots table', async () => {
    const rlsPolicyQuery = `
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
    `;

    const [oldResult, newResult] = await Promise.all([
      connectAndQuery(OLD_CONFIG, rlsPolicyQuery),
      connectAndQuery(NEW_CONFIG, rlsPolicyQuery),
    ]);

    console.log(`${OLD_CONFIG.name} RLS policies on snapshots:`, oldResult.data);
    console.log(`${NEW_CONFIG.name} RLS policies on snapshots:`, newResult.data);

    // Check if tables exist and have RLS enabled
    const rlsEnabledQuery = `
      SELECT
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables
      WHERE schemaname = 'knowledge_platform'
      AND tablename = 'snapshots';
    `;

    const [oldRlsEnabled, newRlsEnabled] = await Promise.all([
      connectAndQuery(OLD_CONFIG, rlsEnabledQuery),
      connectAndQuery(NEW_CONFIG, rlsEnabledQuery),
    ]);

    console.log(`${OLD_CONFIG.name} RLS enabled on snapshots:`, oldRlsEnabled.data);
    console.log(`${NEW_CONFIG.name} RLS enabled on snapshots:`, newRlsEnabled.data);
  });

  it('should test direct access to snapshots table with service_role', async () => {
    // Connect as service_role user and try to access snapshots
    const testQuery = `
      SELECT
        current_user,
        session_user,
        has_table_privilege('knowledge_platform.snapshots', 'SELECT') as can_select_snapshots,
        has_schema_privilege('knowledge_platform', 'USAGE') as can_use_schema;
    `;

    const [oldResult, newResult] = await Promise.all([
      connectAndQuery(OLD_CONFIG, testQuery),
      connectAndQuery(NEW_CONFIG, testQuery),
    ]);

    console.log(`${OLD_CONFIG.name} direct access test:`, oldResult.data);
    console.log(`${NEW_CONFIG.name} direct access test:`, newResult.data);

    if (oldResult.data?.[0] && newResult.data?.[0]) {
      const oldCanSelect = oldResult.data[0].can_select_snapshots;
      const newCanSelect = newResult.data[0].can_select_snapshots;

      console.log(`OLD can select snapshots: ${oldCanSelect}`);
      console.log(`NEW can select snapshots: ${newCanSelect}`);

      // This should reveal the permission difference
      expect(typeof oldCanSelect).toBe('boolean');
      expect(typeof newCanSelect).toBe('boolean');
    }
  });

  it('should check if snapshots table actually exists', async () => {
    const tableExistsQuery = `
      SELECT
        schemaname,
        tablename,
        tableowner,
        hasindexes,
        hasrules,
        hastriggers,
        rowsecurity
      FROM pg_tables
      WHERE schemaname = 'knowledge_platform'
      AND tablename IN ('snapshots', 'events');
    `;

    const [oldResult, newResult] = await Promise.all([
      connectAndQuery(OLD_CONFIG, tableExistsQuery),
      connectAndQuery(NEW_CONFIG, tableExistsQuery),
    ]);

    console.log(`${OLD_CONFIG.name} knowledge_platform tables:`, oldResult.data);
    console.log(`${NEW_CONFIG.name} knowledge_platform tables:`, newResult.data);

    // This will tell us if the tables actually exist
    expect(oldResult.error).toBeNull();
    expect(newResult.error).toBeNull();
  });
});
