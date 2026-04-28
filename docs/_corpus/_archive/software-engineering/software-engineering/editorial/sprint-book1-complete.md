# Editorial Sprint: Book I (Software Engineering) — COMPLETE

## Sprint Scope

Full editorial pass on all 14 chapters (ch00–ch13) of the Software Engineering book.

## Issues Found & Resolved

### 1. Empty Section: ch13 "What MCP Is"

- **File**: `ch13-mcp-nextjs-architecture-and-capability-roadmap.md`
- **Issue**: H2 heading with no content — section was accidentally emptied during practitioner insertion
- **Fix**: Restored MCP definition content (2 paragraphs)

### 2. Missing Intro Paragraph: ch06 "Why 12-Factor Still Matters"

- **File**: `ch06-12-factor-in-the-llm-era.md`
- **Issue**: Section jumped directly into Factor I with no framing paragraph
- **Fix**: Restored introductory paragraph connecting LLM systems to 12-Factor relevance

### 3. Missing Intro Paragraph: ch07 "Why GoF Still Works Here"

- **File**: `ch07-gof-for-ai-native-systems.md`
- **Issue**: Section was empty — H2 header followed immediately by next H2
- **Fix**: Restored 2 framing paragraphs on why GoF patterns apply to AI-native systems

### 4. Inconsistent Title Format

- **All chapters ch01–ch13**: Used ` - ` (hyphen) instead of ` — ` (em dash)
- **Fix**: Normalized all to em dash format for consistency with Book II

### 5. Stale Cross-References

- **Status**: ✅ None found — all ch00 cross-references were cleaned in the previous session

## Structural Verification

- Total lines: 1,716 across 14 chapters
- Chapter range: 75 lines (ch00 preface) to 184 lines (ch13)
- Section count: 6–16 H2 sections per chapter — appropriate variation
- All chapters have: Abstract, practitioner story, principle, repository example, checklist
