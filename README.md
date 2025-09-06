# SmartSuite API Shim

## Quick Start
1. **Prerequisites:** Node.js 18+, npm
2. **Installation:** npm install
3. **Usage:** MCP server for SmartSuite API operations

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

## Coordination Access
Access project management via `.coord/` symlink
