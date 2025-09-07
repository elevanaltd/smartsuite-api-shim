// Context7: consulted for node fetch
// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250905-ad1233d9
// GREEN phase implementation to make authentication tests pass

export interface SmartSuiteClientConfig {
  apiKey: string;
  workspaceId: string;
  baseUrl?: string;
}

// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250905-arch-175

export interface SmartSuiteRecord {
  id: string;
  [fieldId: string]: unknown;
}

export interface SmartSuiteListOptions {
  limit?: number;
  offset?: number;
  sort?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  filter?: Record<string, unknown>;
}

export interface SmartSuiteApiError {
  error?: string;
  message?: string;
  details?: unknown;
}

export interface SmartSuiteSchema {
  id: string;
  name: string;
  structure: Array<{
    id: string;
    slug: string;
    label: string;
    field_type: string;
    params?: Record<string, unknown>;
  }>;
}

export interface SmartSuiteClient {
  apiKey: string;
  workspaceId: string;
  listRecords: (appId: string, options?: SmartSuiteListOptions) => Promise<SmartSuiteRecord[]>;
  getRecord: (appId: string, recordId: string) => Promise<SmartSuiteRecord>;
  createRecord: (appId: string, data: Record<string, unknown>) => Promise<SmartSuiteRecord>;
  updateRecord: (
    appId: string,
    recordId: string,
    data: Record<string, unknown>,
  ) => Promise<SmartSuiteRecord>;
  deleteRecord: (appId: string, recordId: string) => Promise<void>;
  getSchema: (appId: string) => Promise<SmartSuiteSchema>;
}

export async function createAuthenticatedClient(
  config: SmartSuiteClientConfig,
): Promise<SmartSuiteClient> {
  const apiKey = config.apiKey;
  const workspaceId = config.workspaceId;
  const baseUrl = config.baseUrl ?? 'https://api.smartsuite.com';

  // Validate API key by making a test request
  // SmartSuite uses "Token" format and "ACCOUNT-ID" header, not Bearer
  try {
    const validationUrl = baseUrl + '/api/v1/applications';
    const response = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        Authorization: 'Token ' + apiKey,
        'ACCOUNT-ID': workspaceId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorData: Record<string, unknown> = { error: response.statusText };
      try {
        errorData = (await response.json()) as Record<string, unknown>;
      } catch {
        // Use default error if JSON parsing fails
      }

      if (response.status === 401) {
        const message = `Authentication failed: ${String(errorData.error || 'Invalid API key')}`;
        throw new Error(message);
      } else if (response.status === 403) {
        const message = `Authorization failed: ${String(errorData.error || 'No access to workspace')}`;
        throw new Error(message);
      } else if (response.status === 503) {
        const message = `SmartSuite API unavailable: ${String(errorData.error || 'Service temporarily unavailable')}. Try again later.`;
        throw new Error(message);
      } else {
        const message = `API error ${response.status}: ${String(errorData.error || response.statusText)}`;
        throw new Error(message);
      }
    }
  } catch (error: unknown) {
    // Handle network errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage &&
      (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('Network request failed'))
    ) {
      const message =
        'Network error: ' + errorMessage + '. Please check your connection and try again.';
      throw new Error(message);
    }
    // Re-throw other errors (including our custom auth errors)
    throw error;
  }

  // Create and return the client with all required methods
  const client: SmartSuiteClient = {
    apiKey: apiKey,
    workspaceId: workspaceId,

    async listRecords(appId: string, _options?: SmartSuiteListOptions): Promise<SmartSuiteRecord[]> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to list records: ' + response.statusText);
      }

      return response.json() as Promise<SmartSuiteRecord[]>;
    },

    async getRecord(appId: string, recordId: string): Promise<SmartSuiteRecord> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records/' + recordId;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get record: ' + response.statusText);
      }

      return response.json() as Promise<SmartSuiteRecord>;
    },

    async createRecord(appId: string, data: Record<string, unknown>): Promise<SmartSuiteRecord> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create record: ' + response.statusText);
      }

      return response.json() as Promise<SmartSuiteRecord>;
    },

    async updateRecord(appId: string, recordId: string, data: Record<string, unknown>): Promise<SmartSuiteRecord> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records/' + recordId;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update record: ' + response.statusText);
      }

      return response.json() as Promise<SmartSuiteRecord>;
    },

    async deleteRecord(appId: string, recordId: string): Promise<void> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records/' + recordId;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete record: ' + response.statusText);
      }
    },

    async getSchema(appId: string): Promise<SmartSuiteSchema> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/structure';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get schema: ' + response.statusText);
      }

      return response.json() as Promise<SmartSuiteSchema>;
    },
  };

  return client;
}
