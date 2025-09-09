# SmartSuite Intelligent Tool - Learn Mode MVP

## Overview

The `smartsuite_intelligent` tool provides AI-guided access to any SmartSuite API endpoint with knowledge-driven safety protocols. The MVP focuses on **learn mode only**, helping you understand API patterns and avoid known failure modes before attempting operations.

## Quick Start

```typescript
// Learn about an operation before executing
const result = await handler.handleIntelligentOperation({
  mode: 'learn',
  endpoint: '/applications/123/records/list/',
  method: 'POST',
  operation_description: 'List all records in a table',
  payload: { filter: {} }
});
```

## Key Features

### 🧠 Knowledge-Driven Guidance
- Analyzes your intended operation against 14+ known failure patterns
- Provides specific recommendations to avoid common errors
- Suggests corrections for problematic operations

### 🛡️ Safety Assessment Levels

- **🔴 RED**: Critical issues that will cause failures (UUID corruption, wrong methods)
- **🟡 YELLOW**: Warnings that require attention (bulk limits, validation issues)
- **🟢 GREEN**: Safe operations with no known issues

### ⚡ Performance
- LRU cache ensures <100ms response time
- Performance monitoring with alerts for slow operations
- Optimized pattern matching for instant feedback

## Common Use Cases

### 1. Preventing UUID Corruption

```typescript
// DANGEROUS: Will destroy existing UUIDs
const dangerous = {
  mode: 'learn',
  endpoint: '/applications/123/fields/status/change_field',
  method: 'PUT',
  payload: {
    type: 'singleselectfield',
    options: ['Option1', 'Option2'] // ❌ WRONG
  },
  operation_description: 'Update status field options'
};

// Tool will respond with:
// 🔴 CRITICAL: UUID corruption risk
// Suggestion: Use "choices" instead of "options"
// Corrected payload: { choices: ['Option1', 'Option2'] }
```

### 2. Correcting Wrong HTTP Methods

```typescript
// WRONG: GET doesn't work for listing records
const wrong = {
  mode: 'learn',
  endpoint: '/applications/123/records',
  method: 'GET', // ❌ WRONG
  operation_description: 'List records'
};

// Tool will respond with:
// 🔴 CRITICAL: Wrong HTTP method
// Suggestion: Use POST /applications/123/records/list/
```

### 3. Handling Bulk Operation Limits

```typescript
// PROBLEMATIC: Exceeds API limits
const bulk = {
  mode: 'learn',
  endpoint: '/applications/123/records/bulk',
  method: 'POST',
  payload: {
    records: new Array(50).fill({}) // ❌ Too many
  },
  operation_description: 'Bulk update 50 records'
};

// Tool will respond with:
// 🟡 CAUTION: Bulk operation exceeds 25 record limit
// Suggestion: Split into batches of 25 records
```

## Response Structure

```typescript
interface OperationResult {
  mode: 'learn';
  status: 'analyzed' | 'error';
  endpoint: string;
  method: string;
  operation_description: string;
  
  // Knowledge application
  knowledge_applied: boolean;
  knowledge_matches: number;
  knowledge_version: string;
  
  // Safety assessment
  safety_assessment: {
    level: 'RED' | 'YELLOW' | 'GREEN';
    warnings: string[];
    blockers: string[];
    recommendations: string[];
  };
  
  // Guidance and corrections
  guidance: string;
  suggested_correction?: any;
  
  // Performance metrics
  performance_ms: number;
}
```

## Known Patterns (MVP)

The learn mode recognizes these critical patterns:

1. **UUID Corruption Prevention**: Status field updates using wrong parameters
2. **HTTP Method Corrections**: Wrong methods for common endpoints
3. **Bulk Operation Limits**: Operations exceeding 25 record limit
4. **Token Explosion**: Patterns that cause excessive token usage
5. **Delete Operation Safety**: Validation for destructive operations
6. **Field Update Patterns**: Correct approaches for field modifications

## Performance Validation

All operations are monitored for performance:
- Target: <100ms response time
- LRU cache: 100 patterns, 5-minute TTL
- Performance warnings logged for operations >100ms

## Future Enhancements

### Week 2: Dry Run Mode
- Validate operations against live API without execution
- Probe-based validation pattern
- Enhanced error detection

### Week 3: Execute Mode
- Safe execution with automatic safety protocols
- Transaction tracking and rollback capability
- Learning from operation outcomes

### Week 4: Complete Integration
- 100% API coverage
- Comprehensive documentation
- Production monitoring and metrics

## Testing

Run the test suite to verify functionality:

```bash
# Run all intelligent module tests
npm test -- src/intelligent

# Performance validation
npm test -- src/intelligent/knowledge-library.test.ts

# Safety protocol validation
npm test -- src/intelligent/safety-engine.test.ts
```

## Integration Example

```typescript
import { IntelligentOperationHandler, KnowledgeLibrary, SafetyEngine } from './intelligent';

// Initialize components
const knowledgeLibrary = new KnowledgeLibrary();
await knowledgeLibrary.loadFromResearch('./src/knowledge');

const safetyEngine = new SafetyEngine(knowledgeLibrary);
const handler = new IntelligentOperationHandler(knowledgeLibrary, safetyEngine);

// Use in learn mode
const result = await handler.handleIntelligentOperation({
  mode: 'learn',
  endpoint: '/your/endpoint',
  method: 'POST',
  operation_description: 'Your operation',
  payload: { /* your data */ }
});

console.log(`Safety Level: ${result.safety_assessment.level}`);
console.log(`Guidance: ${result.guidance}`);
if (result.suggested_correction) {
  console.log('Suggested correction:', result.suggested_correction);
}
```

## Support

For issues or questions:
- Check the guidance provided by learn mode
- Review known patterns in `/src/knowledge/`
- Consult the research documents in `/coordination/research/`

---

**Version**: 1.0.0 (MVP - Learn Mode Only)  
**Last Updated**: 2025-09-09  
**Ship Date**: Friday (Day 5)