// Unit tests for in-memory EventStore implementation
// ERROR-ARCHITECT: Testing the memory implementation for CI-safe unit tests
// Context7: consulted for vitest
// Context7: consulted for uuid

import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect, beforeEach } from 'vitest';
import { createEventStore } from './event-store-memory.js';
import { EventStore } from './event-store.js';
import { DomainEvent } from './types.js';

describe('EventStore Memory Implementation', () => {
  let eventStore: EventStore;
  const testTenantId = uuidv4();

  beforeEach(() => {
    eventStore = createEventStore(testTenantId);
  });

  describe('creation', () => {
    it('should require tenant ID', () => {
      expect(() => createEventStore('')).toThrow('Tenant ID is required');
    });

    it('should create event store with valid tenant ID', () => {
      const store = createEventStore('test-tenant');
      expect(store).toBeDefined();
    });

    it('should handle UUID tenant IDs', () => {
      const store = createEventStore(uuidv4());
      expect(store).toBeDefined();
    });
  });

  describe('event operations', () => {
    it('should append and retrieve events', async () => {
      const aggregateId = uuidv4();
      const event: DomainEvent = {
        id: uuidv4(),
        aggregateId,
        type: 'TestEventCreated',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { test: 'data' },
        metadata: {
          correlationId: uuidv4(),
          causationId: uuidv4(),
        },
      };

      const eventId = await eventStore.append(event);
      expect(eventId).toBeDefined();

      const events = await eventStore.getEvents(aggregateId);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'TestEventCreated',
        payload: { test: 'data' },
      });
    });

    it('should enforce version sequence', async () => {
      const aggregateId = uuidv4();

      // First event
      await eventStore.append({
        id: uuidv4(),
        aggregateId,
        type: 'Event1',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: {},
        metadata: { correlationId: uuidv4(), causationId: uuidv4() },
      });

      // Try to append with wrong version
      await expect(
        eventStore.append({
          id: uuidv4(),
          aggregateId,
          type: 'Event2',
          version: 3, // Should be 2
          timestamp: new Date(),
          userId: uuidv4(),
          payload: {},
          metadata: { correlationId: uuidv4(), causationId: uuidv4() },
        })
      ).rejects.toThrow('Version mismatch');
    });

    it('should filter events by version', async () => {
      const aggregateId = uuidv4();

      // Add multiple events
      for (let i = 1; i <= 5; i++) {
        await eventStore.append({
          id: uuidv4(),
          aggregateId,
          type: `Event${i}`,
          version: i,
          timestamp: new Date(),
          userId: uuidv4(),
          payload: { index: i },
          metadata: { correlationId: uuidv4(), causationId: uuidv4() },
        });
      }

      const eventsFromV3 = await eventStore.getEvents(aggregateId, 3);
      expect(eventsFromV3).toHaveLength(2);
      expect(eventsFromV3[0]?.version).toBe(4);
      expect(eventsFromV3[1]?.version).toBe(5);
    });
  });

  describe('tenant isolation', () => {
    it('should isolate events between tenants', async () => {
      const tenant1 = createEventStore('tenant-1');
      const tenant2 = createEventStore('tenant-2');
      const aggregateId = uuidv4();

      // Add event to tenant1
      await tenant1.append({
        id: uuidv4(),
        aggregateId,
        type: 'Tenant1Event',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { tenant: 1 },
        metadata: { correlationId: uuidv4(), causationId: uuidv4() },
      });

      // Tenant2 should not see tenant1's events
      const tenant2Events = await tenant2.getEvents(aggregateId);
      expect(tenant2Events).toHaveLength(0);

      // Tenant1 should see its own event
      const tenant1Events = await tenant1.getEvents(aggregateId);
      expect(tenant1Events).toHaveLength(1);
      expect(tenant1Events[0]?.payload.tenant).toBe(1);
    });
  });

  describe('snapshot functionality', () => {
    it('should create snapshots at intervals', async () => {
      const aggregateId = uuidv4();
      const snapshotInterval = 100;

      // Add events up to snapshot interval
      for (let i = 1; i <= snapshotInterval; i++) {
        await eventStore.append({
          id: uuidv4(),
          aggregateId,
          type: 'Event',
          version: i,
          timestamp: new Date(),
          userId: uuidv4(),
          payload: { field: `value_${i}` },
          metadata: { correlationId: uuidv4(), causationId: uuidv4() },
        });
      }

      const snapshot = await eventStore.getSnapshot(aggregateId);
      expect(snapshot).toBeDefined();
      expect(snapshot?.version).toBe(snapshotInterval);
      expect(snapshot?.data.lastVersion).toBe(snapshotInterval);
    });

    it('should return null for non-existent snapshots', async () => {
      const snapshot = await eventStore.getSnapshot(uuidv4());
      expect(snapshot).toBeNull();
    });
  });

  describe('UUID handling', () => {
    it('should convert non-UUID strings deterministically', async () => {
      const store1 = createEventStore('test-tenant');
      const store2 = createEventStore('test-tenant');
      const stringId = 'my-aggregate-id';

      // Both stores should handle the same string ID consistently
      await store1.append({
        id: uuidv4(),
        aggregateId: stringId,
        type: 'Event1',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { from: 'store1' },
        metadata: { correlationId: uuidv4(), causationId: uuidv4() },
      });

      await store2.append({
        id: uuidv4(),
        aggregateId: stringId,
        type: 'Event2',
        version: 2,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { from: 'store2' },
        metadata: { correlationId: uuidv4(), causationId: uuidv4() },
      });

      // Both should see both events (same tenant)
      const events1 = await store1.getEvents(stringId);
      const events2 = await store2.getEvents(stringId);

      expect(events1).toHaveLength(2);
      expect(events2).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('should reject invalid events', async () => {
      const invalidEvent = {
        // Missing required fields
        type: 'InvalidEvent',
        version: 1,
      } as unknown as DomainEvent;

      await expect(eventStore.append(invalidEvent)).rejects.toThrow('Invalid event');
    });
  });
});