# HYBRID GENESIS - Surgical Extraction & Synthesis Plan

## Breakthrough Insight

Staging validates TypeScript compile-time contracts, not SmartSuite runtime contracts. This causes silent data loss because the API accepts invalid payloads that TypeScript thinks are valid.

## The Synthesis: HYBRID GENESIS APPROACH

### Phase 1: Foundation Selection

```
BASE: production/src/ (clean SmartSuite contract adherence)
WHY: Production actually works with real SmartSuite API
```

### Phase 2: Surgical Extraction from Staging

Extract ONLY these healthy components:

1. **NDJSON Logger** (`staging/src/audit/ndjson-logger.ts`)
   - Superior to production's JSON logger
   - Stream-based, memory efficient

2. **Knowledge Platform Core** (without type guards)
   - `staging/src/knowledge-platform/events/`
   - Event sourcing architecture (for REAL undo)

3. **Intelligent Operation Handler** (pattern only)
   - The guided API operation concept
   - NOT the TypeScript validation

### Phase 3: Contract-Driven Validation

Build NEW validation that tests SmartSuite contracts:

```typescript
// WRONG (staging's approach):
function validateChecklist(value: unknown) {
  if (typeof value[0] === 'string') throw; // TypeScript-centric
}

// RIGHT (contract-driven):
async function validateChecklist(value: unknown) {
  const response = await client.testPayload(value);
  if (!response.saved) throw; // SmartSuite-centric
}
```

### Phase 4: Real Undo via Event Sourcing

Replace fake transaction history with event sourcing:

```typescript
// Event store captures actual API operations
interface SmartSuiteEvent {
  id: string;
  timestamp: Date;
  operation: 'create' | 'update' | 'delete';
  tableId: string;
  recordId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  apiResponse: unknown;
}

// Undo replays events in reverse
async function undo(eventId: string) {
  const event = await eventStore.get(eventId);
  return await replayInverse(event);
}
```

### Phase 5: Sentinel Pattern Consolidation

Single unified tool interface:

```typescript
smartsuite_sentinel:
  - discover (field mapping)
  - execute (all operations)
  - validate (contract testing)
  - undo (event replay)
```

## Implementation Path

### Step 1: Create hybrid-genesis branch from production

```bash
git checkout production
git checkout -b hybrid-genesis
```

### Step 2: Extract staging components surgically

```bash
# Extract NDJSON logger
cp staging/src/audit/ndjson-logger.ts src/audit/
cp staging/src/audit/ndjson-logger.test.ts src/audit/

# Extract event sourcing pattern (not implementation)
mkdir -p src/events
# Rewrite from scratch using SmartSuite contracts
```

### Step 3: Build contract-driven validator

```typescript
// src/validation/contract-validator.ts
export class ContractValidator {
  constructor(private client: SmartSuiteClient) {}

  async validatePayload(tableId: string, payload: unknown): Promise<ValidationResult> {
    // Test against ACTUAL SmartSuite API in dry-run mode
    const result = await this.client.validatePayload(tableId, payload);
    return {
      valid: result.wouldSave,
      errors: result.validationErrors,
      warnings: result.formatWarnings,
    };
  }
}
```

### Step 4: Implement event-sourced undo

```typescript
// src/events/event-store.ts
export class SmartSuiteEventStore {
  async capture(operation: ApiOperation): Promise<Event> {
    const event = {
      id: generateEventId(),
      timestamp: new Date(),
      operation: operation.type,
      tableId: operation.tableId,
      recordId: operation.recordId,
      previousState: await this.captureState(operation),
      apiCall: operation.toApiCall(),
    };
    await this.persist(event);
    return event;
  }

  async replay(eventId: string): Promise<void> {
    const event = await this.load(eventId);
    await this.client.execute(event.apiCall);
  }

  async replayInverse(eventId: string): Promise<void> {
    const event = await this.load(eventId);
    const inverse = this.computeInverse(event);
    await this.client.execute(inverse);
  }
}
```

### Step 5: Unify as Sentinel

```typescript
// src/tools/sentinel.ts
export async function handleSentinel(args: SentinelArgs): Promise<unknown> {
  switch (args.operation) {
    case 'discover':
      return discoverFields(args);
    case 'validate':
      return validateContract(args);
    case 'execute':
      return executeWithEventCapture(args);
    case 'undo':
      return undoViaEventReplay(args);
  }
}
```

## Success Criteria

1. **Contract Validation**: Tests validate against real SmartSuite API responses
2. **Event Sourcing**: Every operation captured as replayable event
3. **Real Undo**: Undo actually reverses operations via event replay
4. **Simplified Surface**: Single sentinel tool replaces 6 tools
5. **Preserved Excellence**: NDJSON logger and Knowledge Platform patterns retained

## Migration Strategy

1. Start with production as base (proven to work)
2. Add extracted staging improvements one by one
3. Test each addition against real SmartSuite API
4. Replace TypeScript validation with contract validation
5. Implement event sourcing for real undo
6. Consolidate tools into sentinel pattern

## Verification

### Before (Staging's Problem):

```typescript
// Test passes but SmartSuite rejects
const checklist = ['item1', 'item2'];
validateTypeScript(checklist); // ✓ Passes
await api.save(checklist); // ✗ Silent data loss
```

### After (Hybrid Genesis):

```typescript
// Test validates actual SmartSuite contract
const checklist = ['item1', 'item2'];
await validateContract(checklist); // ✗ Fails: "Invalid SmartDoc format"
const smartDoc = convertToSmartDoc(checklist);
await validateContract(smartDoc); // ✓ Passes
await api.save(smartDoc); // ✓ Data saved correctly
```

## Timeline

1. **Day 1**: Create branch, extract NDJSON logger
2. **Day 2**: Build contract validator with real API tests
3. **Day 3**: Implement event sourcing system
4. **Day 4**: Create sentinel consolidation
5. **Day 5**: Migration testing and verification

This approach transcends the either/or tension by taking the best from both worlds while fixing the core validation problem.
