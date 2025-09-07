# SmartSuite API Shim

**Status:** ✅ Production Ready - B4 Phase Complete  
**Test Coverage:** 83/83 tests passing  
**Server Status:** Fully functional with auto-authentication  

## Quick Start
1. **Prerequisites:** Node.js 18+, npm, SmartSuite API credentials
2. **Installation:** `npm install`
3. **Build:** `npm run build` 
4. **Configuration:** Set environment variables `SMARTSUITE_API_TOKEN` and `SMARTSUITE_WORKSPACE_ID`
5. **Usage:** `npm start` - MCP server with 4 SmartSuite tools ready

## Features

🎯 **Completed B4 Achievements:**
- ✅ **Auto-Authentication** - Environment variable authentication with fail-fast pattern
- ✅ **Field Translation** - Human-readable field names for 9 SmartSuite tables 
- ✅ **4 SmartSuite Tools** - `query`, `record`, `schema`, `undo` operations
- ✅ **DRY-RUN Safety** - Mutation protection with explicit confirmation required
- ✅ **Comprehensive Testing** - 83/83 tests passing with full coverage
- ✅ **CI/CD Integration** - Quality gates and automated validation
- ✅ **Error Handling** - Graceful degradation and clear error messages

### Available Tools
| Tool | Description | Status |
|------|-------------|---------|
| `smartsuite_query` | List, search, get records with human-readable filtering | ✅ Ready |
| `smartsuite_record` | Create, update, delete records with DRY-RUN safety | ✅ Ready |
| `smartsuite_schema` | Get table schema with field mapping information | ✅ Ready |
| `smartsuite_undo` | Transaction rollback operations | ✅ Ready |

### Supported Tables (9 Configured)
- **Projects** (40+ mapped fields) - Core project management
- **Tasks** (30+ mapped fields) - Task tracking and assignments  
- **Videos** (25+ mapped fields) - Video production workflow
- **Clients** (20+ mapped fields) - Client relationship management
- **Schedule** (15+ mapped fields) - Calendar and timeline management
- **Financial Records** (10+ mapped fields) - Cost tracking and invoicing
- **Content Items** (15+ mapped fields) - Content asset management
- **Issue Log** (20+ mapped fields) - Problem tracking and resolution
- **Videos Legacy** (15+ mapped fields) - Backward compatibility

## Development

This is a TypeScript project. The source code is located in the `/src` directory. It is compiled into JavaScript in the `/build` directory for execution. **Do not edit files in `/build` directly, as they will be overwritten.**

### Prerequisites
- Node.js v18.x or higher
- npm

### Running Locally
1. Install dependencies: `npm install`
2. Run in development mode (with auto-reload): `npm run dev`

### Building for Production
1. Compile TypeScript: `npm run build`
2. Run the compiled code: `npm start`

### Testing
- Run all tests: `npm test`
- Run tests with coverage: `npm run test:coverage`
- Watch mode: `npm run test:watch`

## Project Structure
- `src/` - TypeScript source code  
- `build/` - Compiled JavaScript (generated, do not edit)
- `test/` - Test suites
- `docs/` - Documentation
- `reports/` - Build phase reports

## Configuration & Usage

### Environment Variables (Required for Auto-Authentication)
```bash
# Set these for automatic authentication on server startup
export SMARTSUITE_API_TOKEN="your-smartsuite-api-key"
export SMARTSUITE_WORKSPACE_ID="your-workspace-id" 
```

### Production Deployment
```bash
# Compile and run
npm run build
npm start

# Validation mode (for CI/CD)
MCP_VALIDATE_AND_EXIT=true npm start
```

### Integration with Claude Desktop
Add to your Claude Desktop MCP configuration:
```json
{
  "mcpServers": {
    "smartsuite": {
      "command": "node",
      "args": ["/path/to/smartsuite-api-shim/build/src/index.js"],
      "env": {
        "SMARTSUITE_API_TOKEN": "your-api-token",
        "SMARTSUITE_WORKSPACE_ID": "your-workspace-id"
      }
    }
  }
}
```

## Documentation

### User Guide
- **Complete User Guide**: [`docs/007-DOC-B4-USER-GUIDE.md`](./docs/007-DOC-B4-USER-GUIDE.md) - Detailed usage instructions with examples
- **Technical Handoff**: [`docs/006-DOC-B4-HANDOFF.md`](./docs/006-DOC-B4-HANDOFF.md) - Implementation details and architecture

### Example Usage
```javascript
// Query projects with human-readable field names
{
  "operation": "list",
  "appId": "68a8ff5237fde0bf797c05b3",
  "filters": {
    "projectName": "Website Redesign",  // Instead of "project_name_actual"
    "priority": "High",                 // Instead of cryptic priority codes
    "client": "client-abc-123"          // Instead of "sbfc98645c"
  }
}
```

## Coordination Access
Access project management via `.coord/` symlink
