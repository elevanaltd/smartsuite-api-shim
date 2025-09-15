// Unit tests for EventStore - no external dependencies
// These tests verify the contract and behavior without any database
// Context7: consulted for vitest
// Context7: consulted for uuid
import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

import { EventStore, EventStoreMemory, createMemoryEventStore } from './event-store.js';
import { DomainEvent } from './types.js';

describe('EventStore Unit Tests', () => {
  describe('Memory Backend', () => {
    it('should enforce version ordering', async () => {
      const store = createMemoryEventStore();
      const aggregateId = uuidv4();

      const event1: DomainEvent = {
        id: uuidv4(),
        aggregateId,
        type: 'TestEvent',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { test: 'data' },
        metadata: { correlationId: uuidv4(), causationId: uuidv4() },
      };

      await store.append(event1);

      // Try to append version 3 (skipping 2) - should fail
      const event3 = { ...event1, id: uuidv4(), version: 3 };
      await expect(store.append(event3)).rejects.toThrow('Version conflict');
    });

    it('should retrieve events in version order', async () => {
      const store = createMemoryEventStore();
      const aggregateId = uuidv4();

      // Append three events
      for (let i = 1; i <= 3; i++) {
        const event: DomainEvent = {
          id: uuidv4(),
          aggregateId,
          type: 'TestEvent',
          version: i,
          timestamp: new Date(),
          userId: uuidv4(),
          payload: { index: i },
          metadata: { correlationId: uuidv4(), causationId: uuidv4() },
        };
        await store.append(event);
      }

      const events = await store.getEvents(aggregateId);
      expect(events).toHaveLength(3);
      expect(events[0]?.version).toBe(1);
      expect(events[2]?.version).toBe(3);
    });

    it('should support filtering by version', async () => {
      const store = createMemoryEventStore();
      const aggregateId = uuidv4();

      // Append five events
      for (let i = 1; i <= 5; i++) {
        const event: DomainEvent = {
          id: uuidv4(),
          aggregateId,
          type: 'TestEvent',
          version: i,
          timestamp: new Date(),
          userId: uuidv4(),
          payload: { index: i },
          metadata: { correlationId: uuidv4(), causationId: uuidv4() },
        };
        await store.append(event);
      }

      const eventsFrom3 = await store.getEvents(aggregateId, 3);
      expect(eventsFrom3).toHaveLength(3);
      expect(eventsFrom3[0]?.version).toBe(3);
    });

    it('should isolate events by aggregate', async () => {
      const store = createMemoryEventStore();
      const aggregateId1 = uuidv4();
      const aggregateId2 = uuidv4();

      const event1: DomainEvent = {
        id: uuidv4(),
        aggregateId: aggregateId1,
        type: 'TestEvent',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { aggregate: 1 },
        metadata: { correlationId: uuidv4(), causationId: uuidv4() },
      };

      const event2: DomainEvent = {
        id: uuidv4(),
        aggregateId: aggregateId2,
        type: 'TestEvent',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { aggregate: 2 },
        metadata: { correlationId: uuidv4(), causationId: uuidv4() },
      };

      await store.append(event1);
      await store.append(event2);

      const events1 = await store.getEvents(aggregateId1);
      const events2 = await store.getEvents(aggregateId2);

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0]?.payload.aggregate).toBe(1);
      expect(events2[0]?.payload.aggregate).toBe(2);
    });
  });

  describe('Contract Tests', () => {
    // These tests verify the interface contract regardless of backend
    function testEventStoreContract(createStore: () => EventStore) {
      it('should support append and retrieve', async () => {
        const store = createStore();
        const aggregateId = uuidv4();

        const event: DomainEvent = {
          id: uuidv4(),
          aggregateId,
          type: 'ContractTest',
          version: 1,
          timestamp: new Date(),
          userId: uuidv4(),
          payload: { test: 'contract' },
          metadata: { correlationId: uuidv4(), causationId: uuidv4() },
        };

        const eventId = await store.append(event);
        expect(eventId).toBeTruthy();

        const events = await store.getEvents(aggregateId);
        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe('ContractTest');
      });

      it('should enforce version consistency', async () => {
        const store = createStore();
        const aggregateId = uuidv4();

        const event: DomainEvent = {
          id: uuidv4(),
          aggregateId,
          type: 'VersionTest',
          version: 2, // Wrong version (should be 1)
          timestamp: new Date(),
          userId: uuidv4(),
          payload: {},
          metadata: { correlationId: uuidv4(), causationId: uuidv4() },
        };

        await expect(store.append(event)).rejects.toThrow(/[Vv]ersion/);
      });
    }

    describe('Memory Store Contract', () => {
      testEventStoreContract(() => createMemoryEventStore());
    });

    // Future: Add Supabase contract tests when proper test infrastructure exists
  });
});