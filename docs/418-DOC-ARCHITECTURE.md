# SmartSuite API Shim - Architectural Manifest

## System Purpose

Transform SmartSuite's complex API into a **simple, powerful data pipe** that speaks human language, not field codes. Intelligence lives in the LLM agents, infrastructure stays reliable and protective.

## Core Architecture

### Sentinel Architecture (Production Reality)

**Production Interface**: 2 tools only

- `smartsuite_intelligent`: Unified facade accepting natural language operations
- `smartsuite_undo`: Transaction rollback capability

**Implementation**: Protective Facade Pattern

- Accepts natural language and simple parameters from LLM agents
- Routes internally to 8 specialized tool handlers
- Protects against SmartSuite API quirks automatically
- Located in `src/tools/intelligent-facade.ts`

**B3 Integration Status** (2025-09-19):

- ✅ Facade routing fixed - endpoint now optional
- ✅ TypeScript compilation clean
- ⚠️ Integration tests need update to use 2-tool interface
- 🔄 Implementing protective intelligence for API quirks

### Layer Structure

```
LLM Agent Request → MCP Interface → Intelligent Facade → Internal Routing → SmartSuite API
                                            ↓                    ↓              ↓
                                    Protective Logic     Knowledge Base   API Quirk Handler
                                            ↓                    ↓              ↓
                                    Field Discovery      Field Mappings   Format Correction
```

### Facade Input Contract (Planned)

```typescript
interface IntelligentFacadeInput {
  // Natural language intent (required)
  operation_description: string;

  // Human-readable parameters (optional)
  table?: string; // "projects" not cryptic IDs
  recordId?: string; // When operating on specific record
  data?: any; // Mutation data (auto-protected)
  filters?: any; // Query filters (auto-corrected)
  fields?: string[]; // Token optimization
  limit?: number; // Default: 2 (token safety)

  // Routing hints (optional)
  tool_name?: string; // Explicit tool selection
  operation?: string; // Explicit operation type

  // Safety (optional)
  mode?: 'dry_run' | 'execute'; // Default: dry_run
}
```

### Critical Dependencies

- **MCP Protocol**: Standardized tool interface for LLM agents
- **SmartSuite API**: Target system with specific quirks
- **Knowledge Base**: JSON configurations for field mappings and API patterns
- **Protective Intelligence**: Auto-corrections for API requirements

## Key Architectural Decisions

### 1. Protective Intelligence Layer

The facade automatically protects LLM agents from SmartSuite API quirks:

- **Endpoint Generation**: Creates proper endpoints with trailing slashes
- **Method Inference**: Uses PATCH for updates, POST for creates
- **Array Wrapping**: Converts single linked records to arrays
- **Filter Correction**: Changes `is` to `has_any_of` for linked records
- **Field Validation**: Ensures required fields based on knowledge base

### 2. Dry-Run Safety Pattern

- ALL mutations default to `dry_run=true`
- Explicit `mode: 'execute'` required for actual writes
- Transaction IDs provided for all mutations
- Full audit trail in NDJSON format

### 3. Natural Language First

- LLM agents use `operation_description` with natural language
- Technical parameters (endpoint, method) generated automatically
- Human-readable table names preferred over IDs
- Field discovery provides mapping between display names and codes

### 4. Knowledge-Driven Validation

The system uses JSON knowledge bases (`src/knowledge/*.json`) to:

- **api-patterns.json**: SmartSuite API quirks and requirements
- **field-mappings.json**: Human-readable to field code translations
- **safety-protocols.json**: Risk assessment and validation rules
- **operation-templates.json**: Common operation patterns

## Integration Points

### Upstream Dependencies

- Claude MCP server infrastructure
- SmartSuite REST API v1
- Environment variables for auth

### Downstream Impact

- Any MCP client can consume these tools
- Changes to tool signatures break clients
- Knowledge base updates affect all operations

## Common Failure Modes (Auto-Protected)

### 1. Silent Data Loss → PREVENTED

- **Old Problem**: API returns 200 but data not saved
- **Root Cause**: Incorrect field format (especially checklists)
- **Protection**: Facade validates against knowledge base patterns
- **Auto-Correction**: SmartDoc format enforced for checklist fields

### 2. Field Not Found → MITIGATED

- **Old Problem**: "Field 'name' not found" errors
- **Root Cause**: Using display names instead of field IDs
- **Protection**: Field discovery provides automatic mapping
- **Fallback**: Facade suggests correct field names on error

### 3. Filter Operator Mismatch → AUTO-CORRECTED

- **Old Problem**: Linked record queries return empty
- **Root Cause**: Using 'is' instead of 'has_any_of'
- **Protection**: Facade detects linked fields and corrects operators
- **Transparent**: LLM doesn't need to know about this quirk

### 4. Missing Trailing Slash → AUTO-FIXED

- **Old Problem**: Silent failures on certain endpoints
- **Root Cause**: SmartSuite requires trailing slashes
- **Protection**: Facade always adds trailing slash to endpoints

### 5. Wrong HTTP Method → AUTO-INFERRED

- **Old Problem**: Using POST for updates fails
- **Root Cause**: SmartSuite requires PATCH for updates
- **Protection**: Facade infers correct method from operation

## Testing Strategy

### Stratified Testing Model (Refactored 2025-09-19)

**Current State**: Production parity with stratified test architecture

- **Production**: 2-tool Sentinel facade (smartsuite_intelligent + smartsuite_undo)
- **Unit Tests (\*.unit.test.ts)**: Direct imports of individual tool functions, mocked dependencies
- **Integration Tests (\*.integration.test.ts)**: Test through 2-tool production interface

**Architecture Decision**: TEST_MODE removed for test/production parity

**Rationale**:

- Tests must validate actual production system, not fictional 9-tool environment
- CONTRACT-DRIVEN-CORRECTION: Failing integration tests define requirements for facade
- Truth over convenience: Facade complexity exposed through tests, not hidden
- Unit tests validate individual components in isolation
- Integration tests validate facade routing and system contracts

### Test Structure

**Unit Tests** (\*.unit.test.ts):

- `src/tools/*.unit.test.ts`: Individual tool function validation
- Direct imports, mocked dependencies, fast execution

**Integration Tests** (\*.integration.test.ts):

- `test/mcp-server.integration.test.ts`: Production 2-tool interface validation
- `test/audit.integration.test.ts`: Facade routing and audit trail
- `test/mcp-server-auth.integration.test.ts`: Authentication flows
- All test through facade, validate contracts

### Manual Validation Tables

- Primary: `68a8ff5237fde0bf797c05b3` (production)
- Test: `68ab34b30b1e05e11a8ba87f` (safe playground)

## Maintenance Patterns

### When Adding Features

1. Check if knowledge base needs updates
2. Verify field format requirements
3. Test with dry_run first
4. Update integration tests

### When Debugging Issues

1. Check transaction history for recent operations
2. Verify field discovery was run
3. Compare actual payload with knowledge base formats
4. Test same operation in SmartSuite UI

## Performance Characteristics

### Bottlenecks

- SmartSuite API rate limits (undocumented)
- Large record fetches (>1000 records)
- Knowledge base parsing on startup

### Optimization Opportunities

- Cache field mappings per session
- Batch operations where possible
- Limit default query sizes (2-5 records)

## Planned Improvements (B3 Integration)

### Immediate (Current Sprint)

1. **Facade Enhancement** ✅ DONE
   - Make `endpoint` optional (generate from context)
   - Add intelligent endpoint generation with trailing slashes

2. **Protective Intelligence** 🔄 IN PROGRESS
   - Auto-wrap single values in arrays for linked records
   - Correct filter operators for linked record queries
   - Infer HTTP method from operation type
   - Add required fields based on operation context

3. **Test Migration** ⏳ PENDING
   - Update integration tests to use 2-tool interface
   - Add API quirk protection tests
   - Validate Oracle contract patterns

### Future Enhancements

1. **Token Optimization**
   - Implement field selection to return only requested fields
   - Remove empty/null fields from responses
   - Compress metadata for smaller payloads

2. **Error Intelligence**
   - Provide `retry_with` suggestions on errors
   - Map cryptic API errors to helpful messages
   - Include field validation hints

3. **Performance Monitoring**
   - Track operation latencies
   - Identify slow queries
   - Cache frequently used schemas

## Example Usage (Target State)

### LLM Agent Request (Natural Language)

```javascript
await mcp.callTool('smartsuite_intelligent', {
  operation_description: 'Find all videos in production for project EAV042',
  table: 'Videos',
  filters: {
    project_code: 'EAV042',
    status: 'in_production',
  },
  fields: ['title', 'editor', 'due_date'],
  limit: 5,
});
```

### What Happens Behind the Scenes

```javascript
// 1. Facade receives request
// 2. Discovers field mappings for Videos table
// 3. Translates human-readable fields to API codes
// 4. Generates endpoint: /api/v1/applications/68b2437a8f1755b055e0a124/records/list/
// 5. Infers method: POST
// 6. Corrects filter operator for linked fields
// 7. Executes with dry_run first
// 8. Returns cleaned response with only requested fields
```

---

_Last Updated_: 2025-09-19 - Architecture updated with protective intelligence design
_Status_: B3 Integration Phase - Implementing protective facade enhancements
_North Star Alignment_: ✅ Verified - Frictionless API access with safety first
