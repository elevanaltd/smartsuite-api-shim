# SmartSuite API Shim

**Status:** ✅ Production Ready - B5 Enhancement Phase Complete  
**Test Coverage:** 330 tests passing (100% success rate)  
**Server Status:** Fully functional with auto-authentication and critical fixes applied  

## Quick Start
1. **Prerequisites:** Node.js 18+, npm, SmartSuite API credentials
2. **Installation:** `npm install`
3. **Build:** `npm run build` 
4. **Configuration:** Set environment variables `SMARTSUITE_API_TOKEN` and `SMARTSUITE_WORKSPACE_ID`
5. **Usage:** `npm start` - MCP server with 4 SmartSuite tools ready

## Features

🎯 **Completed B5 Achievements:**
- ✅ **Auto-Authentication** - Environment variable authentication with fail-fast pattern
- ✅ **Field Translation** - Human-readable field names for 10 SmartSuite tables 
- ✅ **4 SmartSuite Tools** - `query`, `record`, `schema`, `undo` operations
- ✅ **DRY-RUN Safety** - Mutation protection with explicit confirmation required
- ✅ **Comprehensive Testing** - 330 tests passing with 100% success rate
- ✅ **CI/CD Pipeline** - Fully resolved with CodeQL integration and quality gates
- ✅ **Error Handling** - Graceful degradation and clear error messages
- ✅ **Production Validation** - All critical API fixes applied and verified
- ✅ **Enhanced Code Quality** - Nullish coalescing, console cleanup, path resolution fixes

### Available Tools
| Tool | Description | Status |
|------|-------------|---------|
| `smartsuite_query` | List, search, get records with human-readable filtering | ✅ Ready |
| `smartsuite_record` | Create, update, delete records with DRY-RUN safety | ✅ Ready |
| `smartsuite_schema` | Get table schema with field mapping information | ✅ Ready |
| `smartsuite_undo` | Transaction rollback operations | ✅ Ready |

### Supported Tables (10 Configured with Example Mappings)
- **Projects** (47 mapped fields) - Core project management
- **Tasks** (26 mapped fields) - Task tracking and assignments  
- **Videos** (21 mapped fields) - Video production workflow
- **Clients** (21 mapped fields) - Client relationship management
- **Schedule** (24 mapped fields) - Calendar and timeline management
- **Planning** (25 mapped fields) - Resource planning and phase management
- **Financial Records** - Cost tracking and invoicing
- **Services** - Service catalog and offerings
- **Content Items** - Content asset management
- **Issue Log** (26 mapped fields) - Problem tracking and resolution

**Note:** Field mappings are workspace-specific. Copy examples from `config/field-mappings/examples/` to create your own mappings.

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

### Field Mappings Setup
Since field mappings are workspace-specific and not included in the repository:

1. **Copy example mappings** from `config/field-mappings/examples/`
2. **Remove `.example` suffix** from filenames  
3. **Place in** `config/field-mappings/` directory
4. **Customize** field mappings for your SmartSuite workspace

The system automatically loads all `.yaml` files from `config/field-mappings/` on startup.

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
- **Complete User Guide**: [`docs/guides/001-DOC-GUIDE-USER-GUIDE.md`](./docs/guides/001-DOC-GUIDE-USER-GUIDE.md) - Detailed usage instructions with examples
- **Technical Handoff**: [`docs/delivery/001-DOC-DELIVERY-B4-HANDOFF.md`](./docs/delivery/001-DOC-DELIVERY-B4-HANDOFF.md) - Implementation details and architecture

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
