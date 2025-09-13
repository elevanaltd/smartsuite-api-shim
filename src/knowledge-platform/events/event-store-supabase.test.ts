// Integration tests for Supabase-backed EventStore with proper UUIDs
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { EventStore, createEventStore } from './event-store';
import { DomainEvent } from './types';
import { supabase } from '../infrastructure/supabase-client';
import { checkConnection } from '../infrastructure/supabase-client';
import { v4 as uuidv4 } from 'uuid';

// Skip these tests in CI or when no Supabase configured
const ENABLE_INTEGRATION_TESTS = process.env.KNOWLEDGE_SUPABASE_URL && 
                                 process.env.NODE_ENV !== 'ci';

describe.skipIf(!ENABLE_INTEGRATION_TESTS)('EventStore Supabase Integration', () => {
  const testTenantId = uuidv4(); // Use proper UUID
  let eventStore: EventStore;

  beforeAll(async () => {
    const connected = await checkConnection();
    if (!connected) {
      throw new Error('Cannot connect to Supabase - check .env.knowledge.local');
    }
  });

  beforeEach(async () => {
    eventStore = createEventStore(testTenantId);
    
    // Clean up any existing test data for this tenant
    await supabase
      .from('events')
      .delete()
      .eq('tenant_id', testTenantId);
  });

  describe('persistence', () => {
    it('should persist events to database', async () => {
      const event: DomainEvent = {
        id: uuidv4(),
        aggregateId: uuidv4(),
        type: 'TestEventCreated',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { test: 'data' },
        metadata: {
          correlationId: 'corr_test',
          causationId: 'cause_test'
        }
      };

      const eventId = await eventStore.append(event);

      // Check database directly
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.aggregate_id).toBe(event.aggregateId);
      expect(data.event_type).toBe(event.type);
      expect(data.tenant_id).toBe(testTenantId);
    });

    it('should retrieve persisted events', async () => {
      const aggregateId = uuidv4();
      
      // Add events directly
      for (let i = 1; i <= 3; i++) {
        await supabase
          .from('events')
          .insert({
            id: uuidv4(),
            aggregate_id: aggregateId,
            aggregate_type: 'Test',
            event_type: 'TestEvent',
            event_version: i,
            event_data: { index: i },
            metadata: {},
            created_by: uuidv4(),
            tenant_id: testTenantId
          });
      }

      const events = await eventStore.getEvents(aggregateId);

      expect(events).toHaveLength(3);
      expect(events[0].version).toBe(1);
      expect(events[2].version).toBe(3);
    });
  });

  describe('tenant isolation', () => {
    it('should not see events from other tenants', async () => {
      const otherTenantId = uuidv4();
      const aggregateId = uuidv4();

      // Add event for other tenant
      await supabase
        .from('events')
        .insert({
          id: uuidv4(),
          aggregate_id: aggregateId,
          aggregate_type: 'Test',
          event_type: 'OtherTenantEvent',
          event_version: 1,
          event_data: { tenant: 'other' },
          metadata: {},
          created_by: uuidv4(),
          tenant_id: otherTenantId
        });

      const events = await eventStore.getEvents(aggregateId);
      expect(events).toHaveLength(0);
    });

    it('should maintain separate version sequences per tenant', async () => {
      const otherTenantId = uuidv4();
      const otherStore = createEventStore(otherTenantId);
      const aggregateId = uuidv4();

      const event1: DomainEvent = {
        id: uuidv4(),
        aggregateId,
        type: 'Tenant1Event',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { tenant: 1 },
        metadata: { correlationId: 'c1', causationId: 'c1' }
      };

      const event2: DomainEvent = {
        id: uuidv4(),
        aggregateId,
        type: 'Tenant2Event',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { tenant: 2 },
        metadata: { correlationId: 'c2', causationId: 'c2' }
      };

      await eventStore.append(event1);
      await otherStore.append(event2);

      const tenant1Events = await eventStore.getEvents(aggregateId);
      const tenant2Events = await otherStore.getEvents(aggregateId);

      expect(tenant1Events).toHaveLength(1);
      expect(tenant2Events).toHaveLength(1);
      expect(tenant1Events[0].payload.tenant).toBe(1);
      expect(tenant2Events[0].payload.tenant).toBe(2);
    });
  });

  afterAll(async () => {
    if (ENABLE_INTEGRATION_TESTS) {
      // Clean up test data
      await supabase
        .from('events')
        .delete()
        .eq('tenant_id', testTenantId);
    }
  });
});
