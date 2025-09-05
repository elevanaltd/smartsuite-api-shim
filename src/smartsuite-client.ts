// Context7: consulted for node fetch
// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250905-ad1233d9
// GREEN phase implementation to make authentication tests pass

export interface SmartSuiteClientConfig {
  apiKey: string;
  workspaceId: string;
  baseUrl?: string;
}

export interface SmartSuiteClient {
  apiKey: string;
  workspaceId: string;
  listRecords: (appId: string, options?: any) => Promise<any[]>;
  getRecord: (appId: string, recordId: string) => Promise<any>;
  createRecord: (appId: string, data: any) => Promise<any>;
  updateRecord: (appId: string, recordId: string, data: any) => Promise<any>;
  deleteRecord: (appId: string, recordId: string) => Promise<void>;
  getSchema: (appId: string) => Promise<any>;
}

export async function createAuthenticatedClient(
  config: SmartSuiteClientConfig,
): Promise<SmartSuiteClient> {
  const apiKey = config.apiKey;
  const workspaceId = config.workspaceId;
  const baseUrl = config.baseUrl || 'https://api.smartsuite.com';

  // Validate API key by making a test request
  try {
    const validationUrl = baseUrl + '/workspaces/' + workspaceId;
    const response = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorData: any = { error: response.statusText };
      try {
        errorData = await response.json();
      } catch {
        // Use default error if JSON parsing fails
      }

      if (response.status === 401) {
        const message = 'Authentication failed: ' + (errorData.error || 'Invalid API key');
        throw new Error(message);
      } else if (response.status === 403) {
        const message = 'Authorization failed: ' + (errorData.error || 'No access to workspace');
        throw new Error(message);
      } else if (response.status === 503) {
        const message = 'SmartSuite API unavailable: ' + (errorData.error || 'Service temporarily unavailable') + '. Try again later.';
        throw new Error(message);
      } else {
        const message = 'API error ' + response.status + ': ' + (errorData.error || response.statusText);
        throw new Error(message);
      }
    }
  } catch (error: any) {
    // Handle network errors
    if (error.message && (error.message.includes('ETIMEDOUT') || error.message.includes('Network request failed'))) {
      const message = 'Network error: ' + error.message + '. Please check your connection and try again.';
      throw new Error(message);
    }
    // Re-throw other errors (including our custom auth errors)
    throw error;
  }

  // Create and return the client with all required methods
  const client: SmartSuiteClient = {
    apiKey: apiKey,
    workspaceId: workspaceId,

    async listRecords(appId: string, _options?: any): Promise<any[]> {
      const url = baseUrl + '/applications/' + appId + '/records';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to list records: ' + response.statusText);
      }

      return response.json();
    },

    async getRecord(appId: string, recordId: string): Promise<any> {
      const url = baseUrl + '/applications/' + appId + '/records/' + recordId;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get record: ' + response.statusText);
      }

      return response.json();
    },

    async createRecord(appId: string, data: any): Promise<any> {
      const url = baseUrl + '/applications/' + appId + '/records';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create record: ' + response.statusText);
      }

      return response.json();
    },

    async updateRecord(appId: string, recordId: string, data: any): Promise<any> {
      const url = baseUrl + '/applications/' + appId + '/records/' + recordId;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update record: ' + response.statusText);
      }

      return response.json();
    },

    async deleteRecord(appId: string, recordId: string): Promise<void> {
      const url = baseUrl + '/applications/' + appId + '/records/' + recordId;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete record: ' + response.statusText);
      }
    },

    async getSchema(appId: string): Promise<any> {
      const url = baseUrl + '/applications/' + appId + '/structure';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get schema: ' + response.statusText);
      }

      return response.json();
    },
  };

  return client;
}
