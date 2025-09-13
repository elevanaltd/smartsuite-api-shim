// Supabase-backed Event Store implementation
// TECHNICAL-ARCHITECT: Production-ready with circuit breaker and retry logic

import { DomainEvent, Snapshot } from './types';
import { supabase, knowledgeConfig } from '../infrastructure/supabase-client';
import { dbCircuitBreaker } from '../infrastructure/circuit-breaker';

export class EventStoreSupabase {
  private tenantId: string;
  
  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async append(event: DomainEvent): Promise<string> {
    return dbCircuitBreaker.execute(async () => {
      // Check current version for optimistic concurrency
      const { data: existingEvents, error: versionError } = await supabase
        .from('events')
        .select('event_version')
        .eq('aggregate_id', event.aggregateId)
        .eq('tenant_id', this.tenantId)
        .order('event_version', { ascending: false })
        .limit(1);

      if (versionError && versionError.code !== 'PGRST116') {
        throw new Error(`Version check failed: ${versionError.message}`);
      }

      const currentVersion = existingEvents?.[0]?.event_version || 0;
      const expectedVersion = currentVersion + 1;

      if (event.version !== expectedVersion) {
        throw new Error(`Version conflict: expected ${expectedVersion}, got ${event.version}`);
      }

      // Insert the event
      const { data, error } = await supabase
        .from('events')
        .insert({
          id: event.id,
          aggregate_id: event.aggregateId,
          aggregate_type: 'FieldMapping', // TODO: make dynamic
          event_type: event.type,
          event_version: event.version,
          event_data: event.payload,
          metadata: event.metadata,
          created_by: event.userId,
          tenant_id: this.tenantId
        })
        .select('id')
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          throw new Error(`Version conflict: event version ${event.version} already exists`);
        }
        throw new Error(`Failed to append event: ${error.message}`);
      }

      // Check if we need to create a snapshot
      if (event.version % knowledgeConfig.snapshotInterval === 0) {
        await this.createSnapshot(event.aggregateId, event.version);
      }

      return data.id;
    });
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    return dbCircuitBreaker.execute(async () => {
      let query = supabase
        .from('events')
        .select('*')
        .eq('aggregate_id', aggregateId)
        .eq('tenant_id', this.tenantId)
        .order('event_version', { ascending: true });

      if (fromVersion !== undefined) {
        query = query.gte('event_version', fromVersion);
      }

      query = query.limit(knowledgeConfig.maxEventsPerQuery);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get events: ${error.message}`);
      }

      return (data || []).map(row => ({
        id: row.id,
        aggregateId: row.aggregate_id,
        type: row.event_type,
        version: row.event_version,
        timestamp: new Date(row.created_at),
        userId: row.created_by,
        payload: row.event_data,
        metadata: row.metadata
      }));
    });
  }

  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    return dbCircuitBreaker.execute(async () => {
      const { data, error } = await supabase
        .from('snapshots')
        .select('*')
        .eq('aggregate_id', aggregateId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No snapshot found
        }
        throw new Error(`Failed to get snapshot: ${error.message}`);
      }

      if (!data) return null;

      return {
        id: data.id,
        aggregateId: data.aggregate_id,
        version: data.version,
        timestamp: new Date(data.created_at),
        data: data.state
      };
    });
  }

  private async createSnapshot(aggregateId: string, version: number): Promise<void> {
    // Get all events up to this version
    const events = await this.getEvents(aggregateId);
    
    // Build aggregate state from events
    const state = events.reduce((acc, event) => {
      // Apply event to state (simplified - would be domain-specific)
      return { ...acc, ...event.payload, lastVersion: event.version };
    }, {});

    // Upsert snapshot
    const { error } = await supabase
      .from('snapshots')
      .upsert({
        aggregate_id: aggregateId,
        aggregate_type: 'FieldMapping',
        version: version,
        state: state,
        tenant_id: this.tenantId
      }, {
        onConflict: 'aggregate_id'
      });

    if (error) {
      console.error('Failed to create snapshot:', error);
      // Non-critical - don't fail the event append
    }
  }

  // Retry wrapper for operations
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = knowledgeConfig.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = knowledgeConfig.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

// Factory function for creating event store instances
export function createEventStore(tenantId: string): EventStoreSupabase {
  if (!tenantId) {
    throw new Error('Tenant ID is required for event store');
  }
  return new EventStoreSupabase(tenantId);
}
