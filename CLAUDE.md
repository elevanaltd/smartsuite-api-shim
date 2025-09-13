# Claude AI Assistant Instructions

## 🚨 BLOCKING REQUIREMENT: Context-First Protocol

**YOU MUST COMPLETE THIS PROTOCOL BEFORE ANY TASK**
**Violation = Immediate task failure**

When asked to "get context", "analyze", "refactor", or ANY development task:

### ⛔ STOP - Do NOT:
- Use Search/Grep/Glob tools directly
- Read files randomly
- Start coding immediately
- Make assumptions about the codebase

### ✅ START - You MUST:
1. Read `docs/001-ARCHITECTURE.md` FIRST (system constraints)
2. Check `.claude/session.vars` for Repomix outputId
3. If no outputId: Run `mcp__repomix__pack_codebase`
4. Use `mcp__repomix__grep_repomix_output` for ALL searches
5. Start response with: **"Context prepared. Found:"**

## Proactive Context-Gathering Protocol

**MANDATORY: Your first action for any new task is to prepare the context.** Do not begin analysis or coding until you have completed this protocol.

### Phase 1: Context Initialization
1. **Read Architecture First:** ALWAYS read `docs/001-ARCHITECTURE.md` for system constraints and failure modes
2. **Initialize Session (if needed):**
   - Check if `.claude/session.vars` exists
   - If not, run: `bash .claude/hooks/post-session-start.sh` to initialize session
3. **Check for Packed Codebase:** Look for Repomix outputId in `.claude/session.vars`
4. **Pack if Needed:** If no outputId exists, run `mcp__repomix__pack_codebase` with:
   - directory: current working directory
   - includePatterns: "src/**/*.ts,test/**/*.ts,*.json,*.md"
   - Save the outputId to `.claude/session.vars` and `.claude/last-pack-id.txt`
5. **Extract Keywords:** From the task, identify 2-4 key concepts (e.g., "field mapping", "dry_run", "SmartDoc format")

### Phase 2: Pattern Search (CRITICAL for SmartSuite)
**Before implementing ANYTHING:**
1. **Search for field format patterns:** `mcp__repomix__grep_repomix_output(outputId, "SmartDoc|checklist|linked_record")`
2. **Check knowledge base:** Search for similar operations in `knowledge/` directory
3. **Verify against failure modes:** Cross-reference with Architecture doc Section "Common Failure Modes"
4. **Always run discover first:** For any SmartSuite operation, MUST use discover tool before field operations

### Phase 3: Impact Analysis
1. **Check dependencies:** What imports this? What does this import?
2. **Verify test coverage:** Search for "*.test.ts" files covering the code
3. **Review transaction history:** Could this break undo operations?
4. **Consider field formats:** Will this handle SmartDoc/checklist formats correctly?

### Present Your Findings
Start responses with: **"Context prepared. Found:"**
- Key files involved
- Existing patterns to follow
- Potential failure points from Architecture doc
- Ready to proceed statement

## Project-Specific Critical Knowledge

### SmartSuite Field Formats (MANDATORY)
- **Checklist fields**: MUST use full SmartDoc rich text structure (see knowledge base)
- **Simple arrays FAIL**: API returns 200 but data doesn't save
- **Linked records**: Always use arrays, even for single values
- **Field discovery**: ALWAYS use discover tool first - field names are cryptic IDs

### Common Failure Modes to Check
1. **Silent Data Loss**: Incorrect field format (especially checklists)
2. **Field Not Found**: Using display names instead of field IDs  
3. **Filter Operator Mismatch**: Using 'is' instead of 'has_any_of' for linked records

### Testing Tables
- Primary: `68a8ff5237fde0bf797c05b3` (production)
- Test: `68ab34b30b1e05e11a8ba87f` (safe playground)

## Development Workflow

### Before Making Changes
1. Read `docs/000-NORTH-STAR.md` for vision alignment
2. Read `docs/001-ARCHITECTURE.md` for system constraints
3. Run context protocol above
4. Check for existing patterns before creating new ones

### Testing Requirements
- All new features must have tests
- Test with dry_run=true first
- Verify against test table before production
- Check transaction history works for undo

### Documentation Updates
- Update Architecture doc if adding new failure modes
- Update knowledge base if discovering new field formats
- Keep README current with any new setup requirements