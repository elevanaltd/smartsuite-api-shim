# SmartSuite MCP Record Mutation Guide for Agents

## 🎯 CRITICAL: Two-Step Process Required

**ALL record mutations (create, update, delete) REQUIRE two sequential tool calls:**

### Step 1: Validate with Dry-Run ✅
```javascript
// ALWAYS START HERE
{
  "operation": "create",     // or "update" or "delete"
  "appId": "68ab34b30b1e05e11a8ba87f",
  "dry_run": true,           // MUST BE TRUE
  "data": {
    "title": "Your task",
    "status": "to_do"
  }
}
```

**Response will include:**
```javascript
{
  "dry_run": true,
  "validation_token": "val_1234567890_abc123",  // SAVE THIS!
  "token_expires_in": "5 minutes",
  "message": "Use the validation_token to execute..."
}
```

### Step 2: Execute with Token 🚀
```javascript
// USE THE TOKEN FROM STEP 1
{
  "operation": "create",     // MUST MATCH Step 1
  "appId": "68ab34b30b1e05e11a8ba87f",  // MUST MATCH Step 1
  "dry_run": false,          // NOW SET TO FALSE
  "validation_token": "val_1234567890_abc123",  // FROM STEP 1
  "data": {                  // MUST BE IDENTICAL TO STEP 1
    "title": "Your task",
    "status": "to_do"
  }
}
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ WRONG: Trying to mutate without dry-run
```javascript
{
  "operation": "create",
  "dry_run": false,  // ERROR: No token provided!
  "data": {...}
}
```
**Result:** `Error: Mutation requires either dry_run:true or a valid validation_token`

### ❌ WRONG: Changing data between steps
```javascript
// Step 1: dry_run with "Task A"
// Step 2: execute with "Task B"  // ERROR: Data mismatch!
```
**Result:** Token validation fails - data must be identical

### ❌ WRONG: Waiting too long
```javascript
// Step 1: Get token at 10:00am
// Step 2: Try to use at 10:06am  // ERROR: Token expired!
```
**Result:** Token expires after 5 minutes

---

## 📋 Complete Examples

### Creating a Record
```javascript
// Step 1: Validate
await smartsuite_record({
  operation: "create",
  appId: "68ab34b30b1e05e11a8ba87f",
  dry_run: true,
  data: {
    title: "New Task",
    status: "to_do",
    priority: "high"
  }
});
// Returns: { validation_token: "val_xxx", ... }

// Step 2: Execute
await smartsuite_record({
  operation: "create",
  appId: "68ab34b30b1e05e11a8ba87f",
  dry_run: false,
  validation_token: "val_xxx",  // From Step 1
  data: {
    title: "New Task",
    status: "to_do",
    priority: "high"
  }
});
// Returns: Created record with ID
```

### Updating a Record
```javascript
// Step 1: Validate
await smartsuite_record({
  operation: "update",
  appId: "68ab34b30b1e05e11a8ba87f",
  recordId: "abc123",
  dry_run: true,
  data: {
    status: "complete"
  }
});
// Returns: { validation_token: "val_yyy", ... }

// Step 2: Execute
await smartsuite_record({
  operation: "update",
  appId: "68ab34b30b1e05e11a8ba87f",
  recordId: "abc123",
  dry_run: false,
  validation_token: "val_yyy",
  data: {
    status: "complete"
  }
});
// Returns: Updated record
```

### Deleting a Record
```javascript
// Step 1: Validate
await smartsuite_record({
  operation: "delete",
  appId: "68ab34b30b1e05e11a8ba87f",
  recordId: "abc123",
  dry_run: true
});
// Returns: { validation_token: "val_zzz", ... }

// Step 2: Execute
await smartsuite_record({
  operation: "delete",
  appId: "68ab34b30b1e05e11a8ba87f",
  recordId: "abc123",
  dry_run: false,
  validation_token: "val_zzz"
});
// Returns: { deleted: "abc123" }
```

---

## 🤖 Agent Implementation Pattern

```python
def create_smartsuite_record(app_id, data):
    """Safe two-step record creation"""
    
    # STEP 1: Always validate first
    validation_response = smartsuite_record(
        operation="create",
        appId=app_id,
        dry_run=True,
        data=data
    )
    
    # Extract the token
    token = validation_response["validation_token"]
    
    # STEP 2: Execute with token
    result = smartsuite_record(
        operation="create",
        appId=app_id,
        dry_run=False,
        validation_token=token,
        data=data  # MUST be identical!
    )
    
    return result
```

---

## 🔑 Key Rules

1. **ALWAYS start with `dry_run: true`**
2. **SAVE the `validation_token` from response**
3. **Use token within 5 minutes**
4. **Keep ALL parameters identical between steps**
5. **Token is single-use - get new token for each operation**

---

## 💡 Why This Pattern?

This two-step process ensures:
- ✅ **Safety**: No accidental mutations
- ✅ **Validation**: Data checked before execution
- ✅ **Auditability**: Clear intent with validation step
- ✅ **Consistency**: Exact operation executed as validated

---

## 🆘 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Mutation requires validation_token" | Missing token with dry_run:false | Run with dry_run:true first |
| "Token expired" | Waited >5 minutes | Get new token with dry_run:true |
| "Token validation failed" | Data/params changed | Keep everything identical |
| "Token not found" | Invalid/used token | Tokens are single-use, get new one |

---

## 📝 Quick Reference

```javascript
// PATTERN TO MEMORIZE:
// 1. dry_run: true  → get token
// 2. dry_run: false + token → execute

// NEVER:
// - dry_run: false without token
// - Change data between steps
// - Reuse tokens
// - Wait >5 minutes
```

---

*This guide ensures agents understand the mandatory two-step mutation process for SmartSuite records.*