# SmartSuite API Shim - User Guide

**Version:** 1.1.0  
**Date:** 2025-09-08  
**Status:** ✅ Production Ready with Critical Fixes

## Getting Started

The SmartSuite API Shim transforms cryptic SmartSuite API field codes into human-readable names, making database operations intuitive and error-free.

### Quick Start Example

**Before (Raw API):**
```javascript
// Cryptic and error-prone
{
  "project_name_actual": "My Project",
  "sbfc98645c": "client-id-123", 
  "autonumber": "EAV001"
}
```

**After (Human-Readable):**
```javascript
// Clear and intuitive  
{
  "projectName": "My Project",
  "client": "client-id-123",
  "eavCode": "EAV001"
}
```

## Available Tables

The system supports 9 pre-configured SmartSuite tables with human-readable field mappings:

| Table | Table ID | Description | Fields Mapped |
|-------|----------|-------------|---------------|
| **Projects** | `68a8ff5237fde0bf797c05b3` | Project management | 40+ fields |
| **Tasks** | `6613bedd1889d8deeaef8b0e` | Task tracking | 30+ fields |
| **Videos** | `67ae89f5eb9ccd5cb4ae9b85` | Video production | 25+ fields |
| **Clients** | `6646a2edefe5c3eb5f4b9fb7` | Client management | 20+ fields |
| **Schedule** | `674c30fa0a4b6f966e5a91d0` | Calendar events | 15+ fields |
| **Financial Records** | `667b0d9b22bb04e966a5b3d7` | Financial tracking | 10+ fields |
| **Content Items** | `661a2f9e9e3c4b5a7f8e9d0c` | Content assets | 15+ fields |
| **Issue Log** | `663d4e5f6a7b8c9d0e1f2a3b` | Issue tracking | 20+ fields |
| **Videos Legacy** | `657f8e9d0c1b2a3b4c5d6e7f` | Legacy support | 15+ fields |

## Using the Tools

### 1. Query Records (`smartsuite_query`)

**List all projects with human-readable filters:**
```javascript
{
  "operation": "list",
  "appId": "68a8ff5237fde0bf797c05b3",
  "filters": {
    "projectPhase": "PRODUCTION",    // Instead of "status"
    "priority": "High",              // Instead of raw priority code
    "client": "client-abc-123"       // Instead of "sbfc98645c"
  },
  "sort": {
    "projectName": "asc"             // Instead of "project_name_actual"
  },
  "limit": 10
}
```

**Get a specific project:**
```javascript
{
  "operation": "get", 
  "appId": "68a8ff5237fde0bf797c05b3",
  "recordId": "project-id-123"
}
```

**Search with filters:**
```javascript
{
  "operation": "search",
  "appId": "68a8ff5237fde0bf797c05b3", 
  "filters": {
    "projectName": "Website Redesign"  // Human-readable search
  }
}
```

### 2. Create/Update Records (`smartsuite_record`)

**Create new project (DRY-RUN first):**
```javascript
{
  "operation": "create",
  "appId": "68a8ff5237fde0bf797c05b3",
  "dry_run": true,                    // REQUIRED for safety
  "data": {
    "projectName": "New Website",     // Instead of "project_name_actual"
    "client": "client-xyz-789",       // Instead of "sbfc98645c"
    "priority": "High",               // Instead of priority code
    "projectPhase": "PRE-PRODUCTION", // Instead of "status"
    "initialProjectCost": 15000       // Instead of "initial_cost"
  }
}
```

**Update existing project:**
```javascript
{
  "operation": "update",
  "appId": "68a8ff5237fde0bf797c05b3", 
  "recordId": "project-id-123",
  "dry_run": false,                   // Set to false for actual update
  "data": {
    "projectPhase": "PRODUCTION",     // Human-readable status
    "priority": "Urgent"              // Human-readable priority
  }
}
```

### 3. Get Schema Info (`smartsuite_schema`)

**Check table schema and field mapping availability:**
```javascript
{
  "appId": "68a8ff5237fde0bf797c05b3"
}
```

**Response includes:**
```javascript
{
  "fields": [...],                    // SmartSuite field definitions
  "fieldMappings": {
    "hasCustomMappings": true,        // Field translation available
    "message": "This table supports human-readable field names..."
  }
}
```

## Field Name Examples by Table

### Projects Table
```yaml
# Human Name → API Code
title: title                         # Project Title
projectName: project_name_actual     # Actual Project Name  
client: sbfc98645c                   # Client (Linked Record)
projectManager: project_manager      # Project Manager
priority: priority                   # Priority Level
projectPhase: status                 # Current Phase
initialProjectCost: initial_cost     # Budget
agreementDate: agreement_date        # Contract Date
finalDelivery: final_delivery        # Delivery Date
```

### Tasks Table  
```yaml
# Human Name → API Code
taskTitle: title                     # Task Name
assignedTo: assigned_to              # Task Owner
status: status                       # Task Status
priority: priority                   # Priority Level
dueDate: due_date                   # Deadline
estimatedHours: estimated_hours      # Time Estimate
actualHours: actual_hours           # Time Spent
```

### Videos Table
```yaml
# Human Name → API Code  
videoTitle: title                    # Video Title
videoStatus: status                  # Production Status
videoType: video_type               # Content Type
client: client                      # Client Reference
shootDate: shoot_date               # Filming Date
deliveryDate: delivery_date         # Final Delivery
```

## Error Handling & Safety

### DRY-RUN Pattern
All mutation operations (create/update/delete) **require** the `dry_run` parameter:

```javascript
// ❌ This will fail
{
  "operation": "create",
  "appId": "table-id",
  "data": { "field": "value" }
  // Missing dry_run parameter
}

// ✅ This works  
{
  "operation": "create",
  "appId": "table-id", 
  "data": { "field": "value" },
  "dry_run": true  // REQUIRED for safety
}
```

### Field Validation
When using human-readable field names, the system validates against known mappings:

```javascript
// ❌ Unknown field error
{
  "operation": "create",
  "data": {
    "unknownField": "value"  // Will trigger validation error
  }
}

// ✅ Valid field names
{
  "operation": "create", 
  "data": {
    "projectName": "value",  // Known mapping
    "priority": "High"       // Valid option
  }
}
```

### Graceful Degradation
For tables without field mappings, the system falls back to raw API codes:

```javascript
// Table without mappings - uses raw codes
{
  "operation": "list",
  "appId": "unmapped-table-id",
  "filters": {
    "raw_field_code": "value"  // Falls back to API codes
  }
}
```

## Troubleshooting

### Common Issues

**1. Field mapping not loading:**
```
Field mappings not available - server will use raw API field codes
```
- **Solution:** Check that YAML mapping files exist in `/config/field-mappings/`
- **Workaround:** Use raw API field codes temporarily

**2. Unknown field error:**
```
Unmapped fields found for table projects: invalidField. Available fields: projectName, client, priority...
```
- **Solution:** Use one of the listed available field names
- **Reference:** Check YAML mapping files for correct field names

**3. DRY-RUN required:**
```  
Dry-run pattern required: mutation tools must specify dry_run parameter
```
- **Solution:** Add `"dry_run": true` to create/update/delete operations
- **Production:** Set `"dry_run": false` only when you're certain

**4. Authentication failed:**
```
Authentication required: call authenticate() first
```
- **Solution:** Verify SmartSuite API credentials are configured
- **Check:** Environment variables `SMARTSUITE_API_KEY` and `SMARTSUITE_API_URL`

### Debug Information

**Check server startup:**
```bash
# Should show field mapping loading
Loading field mappings from: /path/to/config/field-mappings
FieldTranslator initialized successfully with 9 mappings
```

**Verify table support:**
Use `smartsuite_schema` tool to check if a table has field mappings available.

## Best Practices

### 1. Always DRY-RUN First
```javascript
// Step 1: Test with dry-run
{ "operation": "create", "dry_run": true, "data": {...} }

// Step 2: Review the translation output  
// Step 3: Execute with dry_run: false if satisfied
```

### 2. Use Human-Readable Names
```javascript
// ✅ Good - Self-documenting
{
  "projectName": "Website Redesign",
  "client": "acme-corp", 
  "priority": "High",
  "projectPhase": "PRODUCTION"
}

// ❌ Avoid - Cryptic and error-prone
{
  "project_name_actual": "Website Redesign",
  "sbfc98645c": "acme-corp",
  "priority": "high",  
  "status": "prod"
}
```

### 3. Leverage Schema Information
Before working with a new table, call `smartsuite_schema` to understand:
- Available field mappings
- Field types and constraints  
- Validation requirements

### 4. Handle Errors Gracefully
```javascript
// Always check for field mapping availability
const schema = await smartsuite_schema({ appId: "table-id" });
if (schema.fieldMappings.hasCustomMappings) {
  // Use human-readable field names
} else {
  // Fall back to raw API codes
}
```

## Advanced Usage

### Batch Operations
```javascript
// Create multiple records with consistent field naming
const projects = [
  {
    "projectName": "Project A",
    "client": "client-1", 
    "priority": "High"
  },
  {
    "projectName": "Project B", 
    "client": "client-2",
    "priority": "Normal"  
  }
];
```

### Complex Filtering
```javascript
{
  "operation": "search",
  "appId": "68a8ff5237fde0bf797c05b3",
  "filters": {
    "projectPhase": "PRODUCTION",
    "priority": ["High", "Urgent"],      // Multiple values
    "client": "important-client",
    "finalDelivery": {                   // Date range
      ">=": "2025-09-01",
      "<=": "2025-12-31" 
    }
  },
  "sort": {
    "priority": "desc",                  // High priority first
    "finalDelivery": "asc"              // Earliest deadline first
  }
}
```

## Support & Resources

### Documentation
- **Handoff Guide:** `006-DOC-B4-HANDOFF.md` - Technical implementation details
- **Field Mappings:** `/config/field-mappings/*.yaml` - Complete field definitions

### Getting Help
1. **Check Schema:** Use `smartsuite_schema` tool to verify field mappings
2. **Validate Fields:** Review YAML mapping files for correct field names  
3. **Test with DRY-RUN:** Always test mutations before executing
4. **Check Logs:** Review server startup logs for field mapping loading

---

**🎯 Transform your SmartSuite experience from cryptic codes to intuitive field names!**

*This guide enables you to leverage the full power of SmartSuite's API through human-readable field names, making database operations faster, safer, and more maintainable.*