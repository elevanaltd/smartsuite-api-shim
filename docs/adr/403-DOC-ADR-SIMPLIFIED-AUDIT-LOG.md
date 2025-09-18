# ADR-403: Simplified Audit Log vs Event Sourcing

**Status:** DEFERRED
**Date:** 2025-09-18
**Decision Makers:** holistic-orchestrator, technical-architect, critical-engineer

## Context

Document 417 identified that event sourcing is over-engineered for a single-user API shim and proposed replacing it with a simple append-only audit log.

## Current State

- Using NDJSON audit logger (audit-logger.ts)
- Append-only file-based logging with O(1) performance
- Already simplified from original event sourcing design
- Working effectively in production

## Proposed Change

Further simplify the audit system:

- Simple database table or file append
- Direct state restoration instead of event replay
- Remove event sourcing complexity
- Focus on forensic analysis rather than state reconstruction

## Decision

**DEFERRED** - The current NDJSON audit logger already provides the simplicity benefits proposed. It's already a simple append-only system without event sourcing complexity.

## Consequences

### Current Benefits (already achieved)

- O(1) append performance
- Simple to understand and debug
- No event replay complexity
- Effective for forensic analysis
- Deadlock-free concurrent operations

### Additional Simplification (not needed)

- Current system is already simple enough
- Moving to database would add dependency
- File-based approach is more portable
- Current solution meets all requirements

## Future Considerations

The current audit logger effectively implements the simplified approach recommended in Document 417. No further simplification needed unless:

- Need to query audit logs with SQL
- Require cross-system audit correlation
- Scale beyond single-user usage

## Implementation Notes

The "undo" functionality is already simplified:

- Shows transaction history (no actual undo)
- Provides recovery guidance
- Maintains audit trail for forensics

## References

- Document 417: BUILD-REVISED-HYBRID-GENESIS-B2.md
- Current implementation: src/audit/audit-logger.ts
- Original proposal: Document 415
