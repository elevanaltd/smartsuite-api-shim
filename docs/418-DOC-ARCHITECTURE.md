# SmartSuite API Shim - Architectural Manifest

## System Purpose

Bridge between Claude MCP protocol and SmartSuite API, providing safe data operations with dry-run defaults.

## Core Architecture

### Sentinel Architecture (Activated 2025-09-19)

**Production Interface**: 2 tools only

- `smartsuite_intelligent`: Unified facade handling all operations via intelligent routing
- `smartsuite_undo`: Separate for safety and direct transaction rollback

**Implementation**: Strangler Fig Pattern

- Facade routes to 8 underlying legacy tools
- Deterministic routing via `tool_name` enum field
- Backward compatible fallback routing
- Located in `src/tools/intelligent-facade.ts`

**Current Status** (2025-09-19):

- Facade expects `endpoint` parameter but receives `operation_description`
- Integration tests failing correctly, defining contracts for routing logic
- Routing logic needs enhancement to parse descriptions into operations

### Layer Structure

```
MCP Interface → Intelligent Facade → Legacy Tool Handlers → SmartSuite Client
                      ↓                      ↓                    ↓
                Tool Registry          Knowledge Base      Transaction History
```

### Critical Dependencies

- **MCP Protocol**: Tool definitions, parameter validation
- **SmartSuite API**: Real-time data operations
- **Knowledge Base**: Field mapping intelligence
- **Transaction History**: Undo capability

## Key Architectural Decisions

### 1. Dry-Run Safety Pattern

- ALL mutations default to dry_run=true
- Explicit confirmation required for writes
- Transaction history for rollback capability

### 2. Field Discovery First

- ALWAYS use discover tool before operations
- Field mappings are non-obvious (cryptic IDs)
- Knowledge base provides format requirements

### 3. Format Requirements (CRITICAL)

- **Checklist Fields**: MUST use SmartDoc rich text format
  - Simple arrays FAIL silently (API 200 but no save)
  - See: api-patterns.json:704
- **Linked Records**: Always arrays, even single values
- **Date Ranges**: from_date/to_date structure required

## Integration Points

### Upstream Dependencies

- Claude MCP server infrastructure
- SmartSuite REST API v1
- Environment variables for auth

### Downstream Impact

- Any MCP client can consume these tools
- Changes to tool signatures break clients
- Knowledge base updates affect all operations

## Common Failure Modes

### 1. Silent Data Loss

- **Symptom**: API returns 200 but data not saved
- **Cause**: Incorrect field format (especially checklists)
- **Prevention**: ALWAYS use discover first, check knowledge base

### 2. Field Not Found

- **Symptom**: "Field 'name' not found" errors
- **Cause**: Using display names instead of field IDs
- **Prevention**: discover tool provides actual field codes

### 3. Filter Operator Mismatch

- **Symptom**: Linked record queries return empty
- **Cause**: Using 'is' instead of 'has_any_of'
- **Prevention**: Check field type in schema

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

---

_Last Updated_: 2025-09-19 - Test architecture refactored for production parity
_Next Review_: When facade routing is fixed to handle operation_description
