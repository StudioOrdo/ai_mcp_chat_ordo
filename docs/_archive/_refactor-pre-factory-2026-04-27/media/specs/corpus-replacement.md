# Feature Spec: Corpus Replacement

**Status:** Draft Spec — Ready for Execution
**Priority:** Phase 1 (foundational — blocks all content work)
**Execution Surface:** File system operations + `book.json` manifests
**Dependencies:** `FileSystemCorpusRepository.ts` (no changes needed — it discovers books from `book.json`)

---

## Purpose

Replace the existing 11-book corpus with a 3-book structure. The system already auto-discovers books via `book.json` manifests in the `docs/_corpus/` tree. This is a file-system operation — no code changes required to the repository, search engine, or rendering layer.

---

## Current State

**11 active books, 101 chapters:**

| Sort | # | Slug | Title | Chapters |
|---|---|---|---|---|
| 0 | 00 | system-docs | Studio Ordo System Documentation | 12 |
| 1 | I | second-renaissance | The Second Renaissance | 8 |
| 2 | II | identity-system | The Identity System | 13 |
| 3 | III | archetype-atlas | The Archetype Atlas | 8 |
| 4 | IV | perception-visual-intelligence | Perception and Visual Intelligence | 8 |
| 5 | V | trust-proof-persuasion | Trust, Proof, and Persuasion | 7 |
| 6 | VI | signal-and-deployment | Signal and Deployment | 8 |
| 7 | VII | building-ai-native-systems | Building AI-Native Systems | 7 |
| 8 | VIII | formation-and-governance | Formation and Governance | 10 |
| 9 | IX | sources-and-lineage | Sources and Intellectual Lineage | 10 |
| 10 | X | curriculum-architecture | Curriculum Architecture | 10 |

---

## Target State

**3 active books, ~45 chapters (starting empty, filled via drafting):**

| Sort | # | Slug | Title | Source Material |
|---|---|---|---|---|
| 1 | I | field-guide | The Field Guide | Compressed from Books I, II, III, V, IX + new memoir |
| 2 | II | operators-handbook | The Operator's Handbook | Mostly new content (Denise/Maria stories) |
| 3 | III | architecture-reference | The Architecture Reference | Compressed from Books 00, IV, VI, VII, VIII, X |

---

## Operations

### Step 1: Archive Existing Books

Move all 11 current book directories to `_corpus/_archive/`:

```bash
# The _archive directory already exists with some old books
mv docs/_corpus/system-docs docs/_corpus/_archive/system-docs
mv docs/_corpus/second-renaissance docs/_corpus/_archive/second-renaissance
mv docs/_corpus/identity-system docs/_corpus/_archive/identity-system
mv docs/_corpus/archetype-atlas docs/_corpus/_archive/archetype-atlas
mv docs/_corpus/perception-visual-intelligence docs/_corpus/_archive/perception-visual-intelligence
mv docs/_corpus/trust-proof-persuasion docs/_corpus/_archive/trust-proof-persuasion
mv docs/_corpus/signal-and-deployment docs/_corpus/_archive/signal-and-deployment
mv docs/_corpus/building-ai-native-systems docs/_corpus/_archive/building-ai-native-systems
mv docs/_corpus/formation-and-governance docs/_corpus/_archive/formation-and-governance
mv docs/_corpus/sources-and-lineage docs/_corpus/_archive/sources-and-lineage
mv docs/_corpus/curriculum-architecture docs/_corpus/_archive/curriculum-architecture
```

**Note:** `FileSystemCorpusRepository` ignores directories starting with `_`. The archive is invisible to the system.

### Step 2: Create Book Manifests

#### `docs/_corpus/field-guide/book.json`
```json
{
  "slug": "field-guide",
  "title": "The Field Guide",
  "number": "I",
  "sortOrder": 1,
  "description": "From the 5th Avenue Photograph to The Passage. Why now, who you are, what you're carrying, and how the cockpit makes you sovereign.",
  "domain": ["teaching", "reference"],
  "tags": ["field-guide", "solopreneur", "identity", "memoir", "AI", "transition"]
}
```

#### `docs/_corpus/operators-handbook/book.json`
```json
{
  "slug": "operators-handbook",
  "title": "The Operator's Handbook",
  "number": "II",
  "sortOrder": 2,
  "description": "Day-by-day operational guide to the Studio Ordo cockpit. From first login to daily practice.",
  "domain": ["teaching"],
  "tags": ["operations", "handbook", "onboarding", "daily-practice", "solopreneur"]
}
```

#### `docs/_corpus/architecture-reference/book.json`
```json
{
  "slug": "architecture-reference",
  "title": "The Architecture Reference",
  "number": "III",
  "sortOrder": 3,
  "description": "How the system works, told by the Machine. Architecture, sovereignty, extensibility, and the $10 stack.",
  "domain": ["reference"],
  "tags": ["architecture", "system-docs", "docker", "sqlite", "mcp", "capability-catalog"]
}
```

### Step 3: Scaffold Chapter Files

Create empty chapter files with rich frontmatter for Book I (the primary book). Books II and III can be scaffolded when drafting begins.

Example: `docs/_corpus/field-guide/chapters/ch01-the-photograph.md`

```markdown
---
title: "The Photograph"
audience: public
voice: architect
emotional_beat: fear
pillar: inversion
armory:
  - key: fourth-turning
    type: briefing
    citation: "Strauss & Howe — The Fourth Turning (1997)"
hope_line: >
  The horse economy ended in 13 years. But someone built the automobile.
  Part IV shows you the automobile.
journal_seeds:
  - brief: "Why 13 years is all you get — the 5th Avenue test for careers in the AI era"
    section: essay
    audience: "Mid-career professionals on LinkedIn"
  - brief: "The 5th Avenue test: is your career the horse or the automobile?"
    section: briefing
    audience: "Solopreneurs evaluating market position"
seo:
  description: "Paradigm shifts happen in 13 years. You are standing in 1906."
  keywords: ["paradigm shift", "AI transition", "career change"]
contributors:
  - Keith Williams
  - Claude
---

# The Photograph

<!-- Chapter content to be drafted -->
```

### Step 4: Verify Discovery

After the archive + scaffold operation, the system should:
1. Discover 3 books via `FileSystemCorpusRepository`
2. Show 3 books in the library index at `/library`
3. Generate sitemap entries for the new book structure
4. Return results from the new corpus in `search_corpus`

---

## Book 00 System Docs Disposition

**Decision: Absorb into Book III, renarrated in dual voice.**

The existing 12 system-docs chapters contain technically excellent material that maps to Book III:

| System Docs Chapter | → Architecture Reference Chapter | Renarration |
|---|---|---|
| ch00: The Thread | → ch01: The Machine Speaks | Machine introduces itself |
| ch01: Proof Story & Value | → (absorbed into Book I, Ch 14) | — |
| ch02: Architecture & Docker | → ch02: The Sovereignty Stack | Machine explains its own architecture |
| ch03: Role System | → ch03: The Governance Layer | Machine explains RBAC |
| ch04: Tooling & MCP | → ch04: The Capability Catalog | Machine shows its tools |
| ch05: Quick Start | → (absorbed into Book II, Ch 1) | — |
| ch06: AI Project Management | → ch05: The Operator's Mind | Machine on AI-native project management |
| ch07: Extending the System | → ch06: Growing the Cockpit | Machine explains extensibility |
| ch08: Search & Retrieval | → ch07: The Search Engine | Machine explains how it finds things |
| ch09: Evaluation Engine | → ch08: The Quality Loop | Machine explains how it measures itself |
| ch10: Data Lifecycle | → (merged into ch02) | — |
| ch11: Deferred Multi-Agent | → (merged into ch05) | — |

The archive content serves as source material. The renarration uses the dual-voice device: the Machine describes what it is, the Architect explains why it was built that way.

---

## Verification

- [ ] `FileSystemCorpusRepository` discovers exactly 3 books
- [ ] Library index page shows 3 book cards
- [ ] Sitemap includes new chapter URLs
- [ ] Search returns results from scaffolded chapters (once content is added)
- [ ] Archived books are NOT discoverable via search or library

---

*Spec drafted by Claude. For implementation by a separate engineering agent or executed directly as file operations.*
