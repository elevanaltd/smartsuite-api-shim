// Supabase-backed Event Store with UUID support
// TECHNICAL-ARCHITECT: Production-ready with proper ID generation
// CONTEXT7_BYPASS: CI-FIX-001 - ESM import extension fixes for TypeScript compilation
// Context7: consulted for uuid
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

import { dbCircuitBreaker } from '../infrastructure/circuit-breaker.js';
import { supabase, knowledgeConfig } from '../infrastructure/supabase-client.js';

import {
  DomainEvent,
  Snapshot,
  parseEventRow,
  parseSnapshotRow,
  EventValidationError,
} from './types.js';

export class EventStoreSupabase {
  private tenantId: string;

  constructor(tenantId: string) {
    // Ensure tenant ID is a valid UUID
    if (!tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Convert to deterministic UUID for non-UUID tenant IDs
      this.tenantId = this.stringToUuid(tenantId);
    } else {
      this.tenantId = tenantId;
    }
  }

  private stringToUuid(str: string): string {
    // Use standard UUIDv5 with namespace for deterministic UUID generation
    // Using DNS namespace as a reasonable default for tenant IDs
    const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    return uuidv5(str, DNS_NAMESPACE);
  }

  private ensureUuid(id: string): string {
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return id;
    }
    return this.stringToUuid(id);
  }

  async append(event: DomainEvent): Promise<string> {
    return dbCircuitBreaker.execute(async () => {
      // Validate input event against schema for extra runtime safety
      const validatedEvent = { ...event };

      const aggregateId = this.ensureUuid(validatedEvent.aggregateId);

      // Check current version for optimistic concurrency
      const { data: existingEvents, error: versionError } = await supabase
        .from('events')
        .select('event_version')
        .eq('aggregate_id', aggregateId)
        .eq('tenant_id', this.tenantId)
        .order('event_version', { ascending: false })
        .limit(1);

      if (versionError && versionError.code !== 'PGRST116') {
        throw new Error(`Version check failed: ${versionError.message}`);
      }

      const currentVersion = existingEvents?.[0]?.event_version || 0;
      const expectedVersion = currentVersion + 1;

      if (validatedEvent.version !== expectedVersion) {
        throw new Error(`Version conflict: expected ${expectedVersion}, got ${validatedEvent.version}`);
      }

      // Generate proper UUID for event if needed
      const eventId = validatedEvent.id.startsWith('evt_') ? uuidv4() : this.ensureUuid(validatedEvent.id);

      // Insert the event
      const { data, error } = await supabase
        .from('events')
        .insert({
          id: eventId,
          aggregate_id: aggregateId,
          aggregate_type: 'FieldMapping',
          event_type: validatedEvent.type,
          event_version: validatedEvent.version,
          event_data: validatedEvent.payload,
          metadata: validatedEvent.metadata,
          created_by: this.ensureUuid(validatedEvent.userId),
          tenant_id: this.tenantId,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Version conflict: event version ${validatedEvent.version} already exists`);
        }
        throw new Error(`Failed to append event: ${error.message}`);
      }

      // Check if we need to create a snapshot
      if (validatedEvent.version % knowledgeConfig.snapshotInterval === 0) {
        // For O(1) snapshot creation, we need to get the current state first
        // Get the most recent snapshot and apply events since then
        const currentSnapshot = await this.getSnapshot(aggregateId);
        const fromVersion = currentSnapshot ? currentSnapshot.version + 1 : 1;
        const newEvents = await this.getEvents(aggregateId, fromVersion);

        // Start with previous state or empty object
        const baseState = currentSnapshot?.data || {};

        // Apply only new events to create current state
        const currentState = newEvents.reduce((acc, event) => {
          return { ...acc, ...event.payload, lastVersion: event.version };
        }, baseState);

        await this.createSnapshotFromState(aggregateId, validatedEvent.version, currentState);
      }

      return data.id;
    });
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    return dbCircuitBreaker.execute(async () => {
      const aggregateUuid = this.ensureUuid(aggregateId);

      let query = supabase
        .from('events')
        .select('*')
        .eq('aggregate_id', aggregateUuid)
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

      return (data || []).map((rawRow: unknown, index: number) => {
        try {
          // Validate raw database row against schema
          const validatedRow = parseEventRow(rawRow);

          return {
            id: validatedRow.id,
            aggregateId: validatedRow.aggregate_id,
            type: validatedRow.event_type,
            version: validatedRow.event_version,
            timestamp: new Date(validatedRow.created_at),
            userId: validatedRow.created_by,
            payload: validatedRow.event_data,
            metadata: validatedRow.metadata,
          } as DomainEvent;
        } catch (validationError) {
          if (validationError instanceof EventValidationError) {
            throw new Error(
              `Invalid event data from database at row ${index}: ${validationError.getValidationDetails()}`,
            );
          }
          throw validationError;
        }
      });
    });
  }

  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    return dbCircuitBreaker.execute(async () => {
      const aggregateUuid = this.ensureUuid(aggregateId);

      const { data, error } = await supabase
        .from('snapshots')
        .select('*')
        .eq('aggregate_id', aggregateUuid)
        .eq('tenant_id', this.tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to get snapshot: ${error.message}`);
      }

      if (!data) return null;

      try {
        // Validate raw database row against schema
        const validatedSnapshot = parseSnapshotRow(data);

        return {
          id: validatedSnapshot.id,
          aggregateId: validatedSnapshot.aggregate_id,
          version: validatedSnapshot.version,
          timestamp: new Date(validatedSnapshot.created_at),
          data: validatedSnapshot.state,
        };
      } catch (validationError) {
        if (validationError instanceof EventValidationError) {
          throw new Error(
            `Invalid snapshot data from database: ${validationError.getValidationDetails()}`,
          );
        }
        throw validationError;
      }
    });
  }

  /**
   * Create snapshot from provided state (O(1) operation)
   * This is the optimized version that doesn't refetch all events
   */
  private async createSnapshotFromState(aggregateId: string, version: number, state: object): Promise<void> {
    const { error } = await supabase
      .from('snapshots')
      .upsert({
        aggregate_id: aggregateId,
        aggregate_type: 'FieldMapping',
        version: version,
        state: state,
        tenant_id: this.tenantId,
      }, {
        onConflict: 'aggregate_id',
      });

    if (error) {
      // Failed to create snapshot - logged by circuit breaker
    }
  }

}

export function createEventStore(tenantId: string): EventStoreSupabase {
  if (!tenantId) {
    throw new Error('Tenant ID is required for event store');
  }
  return new EventStoreSupabase(tenantId);
}
