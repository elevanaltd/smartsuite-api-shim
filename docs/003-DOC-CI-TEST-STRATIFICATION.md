# CI Pipeline Test Stratification

## Technical Architect Approval: CI-pipeline-test-stratification

**Status**: Approved by technical-architect for implementation

## Problem

The CI pipeline was running tests before build, causing `module-resolution.test.ts` to fail because it attempts to execute `build/index.js` which doesn't exist yet.

```
Error: Cannot find module '/home/runner/work/smartsuite-api-shim/smartsuite-api-shim/build/index.js'
```

## Solution: Test Stratification

The technical-architect approved a test stratification approach that recognizes different test types have different dependencies:

### Test Categories
- **Unit Tests**: Test code logic, no build artifacts required  
- **Integration Tests**: Test compiled artifacts, require build to exist first

### Implementation

**Package.json Scripts**:
```json
"test:unit": "vitest run --coverage --exclude '**/module-resolution.test.ts'",
"test:integration": "vitest run --coverage --include '**/module-resolution.test.ts'",
"test:ci": "npm run test:unit"
```

**CI Pipeline Order**:
1. Install dependencies
2. Lint check  
3. Type check
4. **Run unit tests** (fast feedback)
5. **Build project** (create artifacts)
6. **Run integration tests** (validate artifacts)

## Architectural Benefits

- **Fail Fast**: Unit tests provide rapid feedback
- **Proper Dependencies**: Integration tests run after artifacts exist  
- **Performance**: No duplicate builds or wasted CI time
- **Scalability**: Clear pattern for future test organization

## Files Modified

- `package.json`: Added test stratification scripts
- `.github/workflows/ci.yml`: Reordered steps and split test phases

## Technical Architect Validation

> "Not just viable, it is a necessary correction. This isn't about violating test-first principles - it's about recognizing that integration tests have different dependencies than unit tests."