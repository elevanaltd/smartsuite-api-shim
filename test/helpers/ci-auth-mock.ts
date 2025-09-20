// CI Authentication Mock - allows tests to run without real credentials
import { vi } from 'vitest';

export function setupCIMockAuthentication() {
  // Mock environment for CI
  if (process.env.CI) {
    process.env.SMARTSUITE_API_TOKEN_TEST = 'mock-ci-token';
    process.env.SMARTSUITE_WORKSPACE_ID_TEST = 's3qnmox1';

    // Mock the client creation to avoid real API calls
    vi.mock('../../src/smartsuite-client.js', () => ({
      createAuthenticatedClient: vi.fn().mockResolvedValue({
        listRecords: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        getRecord: vi.fn().mockResolvedValue({ id: '1', data: {} }),
        createRecord: vi.fn().mockResolvedValue({ id: '1', data: {} }),
        updateRecord: vi.fn().mockResolvedValue({ id: '1', data: {} }),
        deleteRecord: vi.fn().mockResolvedValue({}),
        getSchema: vi.fn().mockResolvedValue({ id: '1', name: 'Test', structure: [] }),
        countRecords: vi.fn().mockResolvedValue(0),
      }),
    }));
  }
}
