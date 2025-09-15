// In-memory Event Store implementation for unit testing
// ERROR-ARCHITECT: Clean separation - no external dependencies
// This implementation provides the same interface as EventStoreSupabase
// but stores everything in memory for fast, reliable unit tests
// Context7: consulted for uuid

import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { DomainEvent, DomainEventSchema, Snapshot, EventValidationError } from './types.js';
import { EventStore } from './event-store.js';

// Same namespace as production for consistency
const TENANT_ID_NAMESPACE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// Shared storage for testing - in production each instance would have its own DB connection
// This simulates multi-tenant isolation
const globalEventStorage = new Map<string, Map<string, DomainEvent[]>>();
const globalSnapshotStorage = new Map<string, Map<string, Snapshot>>();

export class EventStoreMemory implements EventStore {
  private tenantId: string;
  private events: Map<string, DomainEvent[]>;
  private snapshots: Map<string, Snapshot>;
  private readonly snapshotInterval = 100;

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Ensure tenant ID is a valid UUID
    if (!tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      this.tenantId = this.stringToUuid(tenantId);
    } else {
      this.tenantId = tenantId;
    }

    // Initialize or get existing storage for this tenant
    if (!globalEventStorage.has(this.tenantId)) {
      globalEventStorage.set(this.tenantId, new Map());
      globalSnapshotStorage.set(this.tenantId, new Map());
    }

    this.events = globalEventStorage.get(this.tenantId)!;
    this.snapshots = globalSnapshotStorage.get(this.tenantId)!;
  }

  private stringToUuid(str: string): string {
    return uuidv5(str, TENANT_ID_NAMESPACE);
  }

  private ensureUuid(id: string | undefined): string {
    if (!id) {
      return uuidv4(); // Generate new UUID if missing
    }
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return id;
    }
    return this.stringToUuid(id);
  }

  async append(event: DomainEvent): Promise<string> {
    // Ensure UUIDs BEFORE validation (so validation sees proper UUIDs)
    const eventWithUuids = {
      ...event,
      id: this.ensureUuid(event.id),
      aggregateId: this.ensureUuid(event.aggregateId),
      userId: this.ensureUuid(event.userId),
    } as DomainEvent;

    // Validate event with UUIDs
    const validation = DomainEventSchema.safeParse(eventWithUuids);
    if (!validation.success) {
      throw new EventValidationError(
        `Invalid event: ${validation.error.errors.map(e => e.message).join(', ')}`
      );
    }

    // Get or create event list for aggregate
    const aggregateId = eventWithUuids.aggregateId;
    if (!this.events.has(aggregateId)) {
      this.events.set(aggregateId, []);
    }

    const aggregateEvents = this.events.get(aggregateId)!;

    // Verify version sequence
    const expectedVersion = aggregateEvents.length + 1;
    if (eventWithUuids.version !== expectedVersion) {
      throw new Error(
        `Version mismatch: expected ${expectedVersion}, got ${eventWithUuids.version}`
      );
    }

    // Append event
    aggregateEvents.push(eventWithUuids);

    // Create snapshot if needed
    if (aggregateEvents.length % this.snapshotInterval === 0) {
      await this.createSnapshot(aggregateId, aggregateEvents);
    }

    return eventWithUuids.id;
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const uuid = this.ensureUuid(aggregateId);
    const events = this.events.get(uuid) || [];

    if (fromVersion !== undefined) {
      return events.filter(e => e.version > fromVersion);
    }

    return [...events]; // Return copy to prevent mutation
  }

  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    const uuid = this.ensureUuid(aggregateId);
    return this.snapshots.get(uuid) || null;
  }

  private async createSnapshot(aggregateId: string, events: DomainEvent[]): Promise<void> {
    const latestVersion = events[events.length - 1]?.version || 0;

    // Build aggregate state from events
    const aggregateState = events.reduce((state, event) => {
      // Simple state accumulation - customize based on your domain
      return {
        ...state,
        ...event.payload,
        lastVersion: event.version,
        lastUpdated: event.timestamp,
      };
    }, {} as Record<string, unknown>);

    const snapshot: Snapshot = {
      id: uuidv4(),
      aggregateId,
      version: latestVersion,
      data: aggregateState,
      createdAt: new Date(),
    };

    this.snapshots.set(aggregateId, snapshot);
  }

  // Test helper methods
  async clear(): Promise<void> {
    this.events.clear();
    this.snapshots.clear();
  }

  async getAllEvents(): Promise<DomainEvent[]> {
    const allEvents: DomainEvent[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events);
    }
    return allEvents;
  }
}

// Factory function matching Supabase interface
export function createEventStore(tenantId: string): EventStore {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  return new EventStoreMemory(tenantId);
}