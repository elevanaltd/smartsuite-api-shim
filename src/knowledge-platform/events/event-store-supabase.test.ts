// Integration tests for Supabase-backed EventStore
// TECHNICAL-ARCHITECT: Verifies persistence and tenant isolation

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { EventStore, createEventStore } from './event-store';
import { DomainEvent } from './types';
import { supabase } from '../infrastructure/supabase-client';
import { checkConnection } from '../infrastructure/supabase-client';

// Skip these tests in CI or when no Supabase configured
const ENABLE_INTEGRATION_TESTS = process.env.KNOWLEDGE_SUPABASE_URL && 
                                 process.env.NODE_ENV !== 'ci';

describe.skipIf(!ENABLE_INTEGRATION_TESTS)('EventStore Supabase Integration', () => {
  const testTenantId = 'test-tenant-' + Date.now();
  let eventStore: EventStore;

  beforeAll(async () => {
    // Verify connection
    const connected = await checkConnection();
    if (!connected) {
      throw new Error('Cannot connect to Supabase - check .env.knowledge.local');
    }
  });

  beforeEach(async () => {
    // Create store with test tenant
    eventStore = createEventStore(testTenantId);
    
    // Clean up any existing test data
    await supabase
      .from('events')
      .delete()
      .eq('tenant_id', testTenantId);
  });

  describe('persistence', () => {
    it('should persist events to database', async () => {
      // Arrange
      const event: DomainEvent = {
        id: 'evt_test_1',
        aggregateId: 'agg_test_1',
        type: 'TestEventCreated',
        version: 1,
        timestamp: new Date(),
        userId: 'user_test',
        payload: { test: 'data' },
        metadata: {
          correlationId: 'corr_test',
          causationId: 'cause_test'
        }
      };

      // Act
      const eventId = await eventStore.append(event);

      // Assert - check database directly
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
      // Arrange - add events directly
      const aggregateId = 'agg_test_2';
      
      for (let i = 1; i <= 3; i++) {
        await supabase
          .from('events')
          .insert({
            aggregate_id: aggregateId,
            aggregate_type: 'Test',
            event_type: 'TestEvent',
            event_version: i,
            event_data: { index: i },
            metadata: {},
            created_by: 'user_test',
            tenant_id: testTenantId
          });
      }

      // Act
      const events = await eventStore.getEvents(aggregateId);

      // Assert
      expect(events).toHaveLength(3);
      expect(events[0].version).toBe(1);
      expect(events[2].version).toBe(3);
    });
  });

  describe('tenant isolation', () => {
    it('should not see events from other tenants', async () => {
      // Arrange
      const otherTenantId = 'other-tenant-' + Date.now();
      const aggregateId = 'shared_agg_id';

      // Add event for other tenant
      await supabase
        .from('events')
        .insert({
          aggregate_id: aggregateId,
          aggregate_type: 'Test',
          event_type: 'OtherTenantEvent',
          event_version: 1,
          event_data: { tenant: 'other' },
          metadata: {},
          created_by: 'other_user',
          tenant_id: otherTenantId
        });

      // Act - try to get events with our tenant
      const events = await eventStore.getEvents(aggregateId);

      // Assert - should not see other tenant's events
      expect(events).toHaveLength(0);
    });

    it('should maintain separate version sequences per tenant', async () => {
      // Arrange
      const otherTenantId = 'other-tenant-' + Date.now();
      const otherStore = createEventStore(otherTenantId);
      const aggregateId = 'shared_agg_id_2';

      const event1: DomainEvent = {
        id: 'evt_tenant1',
        aggregateId,
        type: 'Tenant1Event',
        version: 1,
        timestamp: new Date(),
        userId: 'user1',
        payload: { tenant: 1 },
        metadata: { correlationId: 'c1', causationId: 'c1' }
      };

      const event2: DomainEvent = {
        id: 'evt_tenant2',
        aggregateId,
        type: 'Tenant2Event',
        version: 1, // Same version for different tenant
        timestamp: new Date(),
        userId: 'user2',
        payload: { tenant: 2 },
        metadata: { correlationId: 'c2', causationId: 'c2' }
      };

      // Act - both should succeed
      await eventStore.append(event1);
      await otherStore.append(event2);

      // Assert
      const tenant1Events = await eventStore.getEvents(aggregateId);
      const tenant2Events = await otherStore.getEvents(aggregateId);

      expect(tenant1Events).toHaveLength(1);
      expect(tenant2Events).toHaveLength(1);
      expect(tenant1Events[0].payload.tenant).toBe(1);
      expect(tenant2Events[0].payload.tenant).toBe(2);
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    if (ENABLE_INTEGRATION_TESTS) {
      await supabase
        .from('events')
        .delete()
        .match({ tenant_id: testTenantId });
    }
  });
});
