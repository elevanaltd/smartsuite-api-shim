// Event Store implementation for Knowledge Platform
// TEST COMMIT: 9617b92 - implementing to satisfy failing tests

import { DomainEvent, Snapshot } from './types';

export class EventStore {
  private events: Map<string, DomainEvent[]> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private versions: Map<string, number> = new Map();

  async append(event: DomainEvent): Promise<string> {
    const currentVersion = this.versions.get(event.aggregateId) || 0;
    const expectedVersion = currentVersion + 1;

    // Validate version for optimistic concurrency control
    if (event.version !== expectedVersion) {
      throw new Error(`Version conflict: expected ${expectedVersion}, got ${event.version}`);
    }

    // Store the event
    if (!this.events.has(event.aggregateId)) {
      this.events.set(event.aggregateId, []);
    }
    this.events.get(event.aggregateId)!.push(event);
    this.versions.set(event.aggregateId, event.version);

    return event.id;
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const events = this.events.get(aggregateId) || [];
    
    if (fromVersion === undefined) {
      return events;
    }

    return events.filter(e => e.version >= fromVersion);
  }

  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    return this.snapshots.get(aggregateId) || null;
  }
}
