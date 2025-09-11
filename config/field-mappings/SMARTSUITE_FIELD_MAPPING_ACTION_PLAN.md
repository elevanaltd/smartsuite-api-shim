# SmartSuite Field Mapping Update - Action Plan

**Date**: 2025-09-11  
**Critical Finding**: Major discrepancies discovered in field mappings

## Executive Summary

**CRITICAL ISSUE FOUND**: The Tasks table has been completely replaced but the field mappings still point to the old, hidden table. This is causing operational failures.

## Current State Analysis

### ✅ Actually Active Tables (8)
1. **Projects** (68a8ff5237fde0bf797c05b3) - ✅ Updated
2. **Clients** (68a8ff34dc58deda12a3bc02) - ⚠️ Needs verification
3. **Services** (68b7fb8ed78e0c91416c1787) - ⚠️ Needs verification  
4. **Financial Records** (68b1cecc4b54c373a5f6fdf5) - ⚠️ Needs verification
5. **Videos** (68b2437a8f1755b055e0a124) - ⚠️ Needs verification
6. **Tasks** (68c24591b7d2aad485e8f781) - 🔴 **WRONG TABLE ID IN YAML**
7. **Schedule** (68a8ffb767da02533af2bc9c) - ⚠️ Needs verification
8. **Issue Log** (68ac236dc90313c20428b15f) - ⚠️ Needs verification

### ❌ Obsolete Tables (2)
- **content-items.yaml** - Table deleted from SmartSuite
- **planning.yaml** - Table deleted from SmartSuite

### 🔴 Critical Issues Found

#### Tasks Table Completely Wrong
- **Current YAML points to**: 68a8ffac490e5496953e5b1c ("Tasks-old", hidden)
- **Should point to**: 68c24591b7d2aad485e8f781 ("Tasks", active)
- **Impact**: All task operations failing or returning incorrect data
- **Field structure**: Completely different - new simplified structure

## Immediate Actions Required

### 1. Fix Tasks Table (URGENT)
```yaml
# MUST UPDATE tasks.yaml:
tableId: 68c24591b7d2aad485e8f781  # NOT 68a8ffac490e5496953e5b1c
tableName: Tasks  # NOT Tasks-old

# New field structure (simplified from old):
- task12code (17 options, simplified from 22)
- taskvar890 (12 variants)
- No more "task_level" field
- New auto-calculation formulas for hours
- Different dependency structure
```

### 2. Delete Obsolete Files
```bash
rm /Volumes/HestAI-Projects/smartsuite-api-shim/staging/config/field-mappings/content-items.yaml
rm /Volumes/HestAI-Projects/smartsuite-api-shim/staging/config/field-mappings/planning.yaml
```

### 3. Verify Remaining Tables
Need to check if other tables have been similarly replaced without notice.

## Smart Approach: Automated Schema Sync

Instead of manual updates, implement:

### Option 1: Direct Schema Generation (Recommended)
```python
# For each active table:
1. Fetch schema via MCP
2. Auto-generate YAML with:
   - All field slugs
   - Field types
   - Required/optional status
   - Choice options for selects
3. Preserve human-friendly names where they exist
4. Flag new/changed/removed fields
```

### Option 2: Validation Script
```python
# Daily/weekly run:
1. Compare live schemas with YAMLs
2. Report discrepancies
3. Auto-update non-breaking changes
4. Flag breaking changes for review
```

## Root Cause Analysis

### Why This Happened
1. **Silent table replacement** - SmartSuite replaced Tasks table without notification
2. **No version tracking** - No way to detect schema changes
3. **Manual maintenance** - YAMLs updated manually, prone to drift
4. **Hidden table trap** - Old table still exists but hidden, masking the issue

### Prevention Strategy
1. **Automated sync** - Script to pull schemas and update YAMLs
2. **Version tracking** - Add schema version/hash to YAMLs
3. **Regular validation** - CI job to verify mappings weekly
4. **Change detection** - Alert when schemas change

## Implementation Priority

### Phase 1: Emergency Fix (TODAY)
- [ ] Update tasks.yaml with correct table ID
- [ ] Delete obsolete YAML files
- [ ] Test task operations

### Phase 2: Verification (THIS WEEK)
- [ ] Verify all 8 active tables
- [ ] Update any other incorrect mappings
- [ ] Document all changes

### Phase 3: Automation (NEXT WEEK)
- [ ] Create schema sync script
- [ ] Add validation tests
- [ ] Set up monitoring

## Testing Checklist

After updates:
- [ ] Tasks can be created via API
- [ ] Task queries return correct data
- [ ] Field mappings work for all operations
- [ ] No 404 errors for table operations
- [ ] Linked records resolve correctly

## Lessons Learned

1. **Trust but verify** - MCP shows all tables, including obsolete ones
2. **Hidden doesn't mean gone** - Old tables remain accessible
3. **Schema evolution** - Tables can be completely replaced
4. **Automation essential** - Manual maintenance unsustainable

## Recommended Tool

Create `sync-field-mappings.py` that:
1. Uses SmartSuite MCP to discover tables
2. Fetches current schemas
3. Generates accurate YAML files
4. Preserves custom naming where valid
5. Reports all changes
6. Runs on schedule (weekly/daily)

This would prevent future drift and catch changes immediately.