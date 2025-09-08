# CodeQL Permissions Fix Documentation

## Issue Summary
CodeQL integration was failing with "Resource not accessible by integration" errors during SARIF results upload and telemetry gathering in GitHub Actions CI pipeline.

## Root Cause Analysis

### Classification: COMPLEX (CI/CD Integration Issue)
- **Impact Radius**: CI/CD pipeline, security scanning, GitHub integration
- **Resolution Strategy**: Architectural fix with proper permissions configuration

### Evidence Gathered
1. CodeQL successfully scans TypeScript files (3 files processed)
2. SARIF file generation and validation succeeds
3. Upload fails with permission error
4. Telemetry gathering also fails with same error

### Root Cause
The `GITHUB_TOKEN` provided to the workflow lacks necessary permissions for CodeQL operations. By default, GitHub Actions provides minimal permissions, and CodeQL requires specific scopes:
- `security-events: write` - To upload SARIF results and create security alerts
- `actions: read` - To read workflow metadata for telemetry
- `contents: read` - To checkout and scan code

## Solution Applied

Added explicit permissions block to the `security-scan` job in `.github/workflows/ci.yml`:

```yaml
security-scan:
  name: Security Scan
  runs-on: ubuntu-latest
  permissions:
    actions: read        # Required for workflow metadata
    contents: read       # Required to checkout code
    security-events: write  # Required to upload SARIF results
```

## Repository Settings Requirements

### CRITICAL: Repository Configuration
Navigate to: **Settings > Actions > General > Workflow permissions**

Ensure one of these configurations:
1. **Recommended**: Set to "Read and write permissions"
2. **Alternative**: Keep "Read repository contents permission" BUT add job-level permissions (as implemented)

If repository is part of an organization:
- Check organization-level settings which may override repository settings
- Contact org admin if permissions are restricted at org level

## Security Considerations

### Principle of Least Privilege
- Permissions are scoped to the specific job that needs them
- Other jobs in the workflow run with default (minimal) permissions
- No use of `write-all` or overly broad permissions
- Temporary `GITHUB_TOKEN` is more secure than PATs

### Why Not Alternative Authentication?
- Personal Access Tokens (PATs) are long-lived and user-tied (security risk)
- GitHub Apps add unnecessary complexity
- `GITHUB_TOKEN` is designed for this exact use case

## Verification Steps

1. **Local Validation**: Changes have been applied to `.github/workflows/ci.yml`
2. **CI Validation**: Next push/PR will trigger the workflow with proper permissions
3. **Expected Outcome**: CodeQL should successfully upload SARIF results

## Prevention Measures

### Patterns Established
- Always specify required permissions at job level for security-sensitive operations
- Document permission requirements in workflow comments
- Follow GitHub Actions security best practices

### Monitoring
- Watch for "Resource not accessible by integration" errors in CI logs
- Regular audit of workflow permissions
- Keep CodeQL action updated to latest version

## References
- [GitHub Docs: Assigning permissions to jobs](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)
- [CodeQL Action Requirements](https://github.com/github/codeql-action)
- Critical-Engineer consultation for security hardening approach

## Evidence of Fix
```bash
# Diff showing permissions added
--- .github/workflows/ci.yml.bak
+++ .github/workflows/ci.yml
@@ -56,6 +56,10 @@
   security-scan:
     name: Security Scan
     runs-on: ubuntu-latest
+    permissions:
+      actions: read        # Required for workflow metadata
+      contents: read       # Required to checkout code
+      security-events: write  # Required to upload SARIF results
```

This fix follows the intelligent assessment approach: complex CI/CD integration issue requiring architectural solution with proper security considerations.