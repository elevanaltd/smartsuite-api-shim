# DEPRECATED TESTS - QUARANTINED

## Purpose

These tests were written for the obsolete 9-tool architecture that no longer exists. They are preserved here for reference but should NOT be used as-is.

## Architecture Change

- **OLD**: 9 individual tools (smartsuite_query, smartsuite_record, etc.)
- **NEW**: 2 tools only (smartsuite_intelligent facade + smartsuite_undo)

## Test Methodology Guardian Decision

Per Test Methodology Guardian mandate, these tests violate the TRUTH OVER CONVENIENCE principle because they test a system contract that no longer exists. Attempting to patch them would be INVALID.

## Strategic Rewrite Approach

- **Phase 1**: QUARANTINE ✓ (in progress)
- **Phase 2**: Understand new 2-tool contract
- **Phase 3**: Write NEW tests from scratch for actual architecture
- **Phase 4**: Ensure full TypeScript type safety
- **Phase 5**: Validate 90%+ coverage of critical paths

## DO NOT

- Copy/paste code from these tests
- Patch these tests to make them pass
- Use these as templates for new tests

## DO

- Use these for understanding test patterns and edge cases
- Reference for understanding business requirements
- Learn from testing approaches (but reimplement for new architecture)

## Migration Status

Date: 2025-09-20
Status: Strategic incremental rewrite in progress
New test structure: test/unit/, test/integration/, test/e2e/
