# ADR-501: Local Schema Validation with AJV

**Status:** DEFERRED
**Date:** 2025-09-18
**Decision Makers:** holistic-orchestrator, technical-architect, code-review-specialist

## Context

Document 417 proposed replacing the current Zod-based network validation with local schema validation using AJV to improve performance and reliability by removing network dependencies from the validation path.

## Current State

- Using Zod for runtime validation at API boundaries
- Validation is synchronous and local (no network calls)
- Working and tested in production
- Part of the input-validator.ts layer

## Proposed Change

Replace Zod validation with AJV-based schema validation:

- Pre-compile schemas at startup for performance
- Use JSON Schema format for portability
- Cache compiled validators for fast execution
- Achieve <1ms validation times

## Decision

**DEFERRED** - The current Zod validation is working effectively and the performance difference (microseconds) doesn't justify the refactoring effort at this time.

## Consequences

### Positive (if implemented)

- Slightly faster validation (<1ms vs current)
- JSON Schema is more portable
- Could enable schema sharing with other systems

### Negative (if implemented)

- Major refactoring of working code
- Risk of introducing bugs
- All existing tests would need updates
- Marginal performance gain not worth the risk

## Future Considerations

Revisit this decision if:

- Performance profiling shows validation as a bottleneck
- Need to share schemas with non-TypeScript systems
- Moving to a schema-first development approach

## References

- Document 417: BUILD-REVISED-HYBRID-GENESIS-B2.md
- Current implementation: src/validation/input-validator.ts
- Zod documentation: https://zod.dev
