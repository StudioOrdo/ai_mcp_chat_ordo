# Technical Audit: Book Rendering System

## Overview

The Studio Ordo corpus rendering system is a file-system-based document engine
that discovers, parses, and serves structured content from `docs/_corpus/`.
This audit documents how it works, what it supports, and what must be done
to deploy the three books into the live system.

---

## Architecture

### Discovery

The `FileSystemCorpusRepository` scans `docs/_corpus/` at startup:

1. Reads each subdirectory for a `book.json` manifest
2. Validates required fields: `slug`, `title`, `number`, `sortOrder`, `domain`
3. Enforces slug-directory name match (mismatch → skip with degradation log)
4. Sorts documents by `sortOrder` ascending
5. Caches discovered documents in memory

### Document Manifest Schema (`book.json`)

```json
{
  "slug": "string (must match directory name)",
  "title": "string",
  "number": "string (e.g., 'I', 'II', '00')",
  "sortOrder": "number (determines navigation order)",
  "domain": "string[] (valid: teaching, sales, customer-service, reference, internal)",
  "description": "string (optional)",
  "tags": "string[] (optional, used for search)",
  "audience": "ContentAudience (optional, default: 'public')"
}
```

### Chapter Discovery

Chapters are markdown files in `{slug}/chapters/`. They are:
1. Read from the directory, filtered to `.md` extension
2. Sorted alphabetically (filename determines order, so prefix with `ch01-`, `ch02-`, etc.)
3. Parsed for frontmatter (YAML between `---` delimiters)
4. Parsed for title (first `# heading` in body)
5. Parsed for sub-headings (all `## headings` extracted for navigation)
6. Analyzed for contributor mentions and checklist supplements

### Frontmatter Schema (per chapter)

```yaml
---
audience: public | internal  # Optional, inherits from book.json
---
```

The frontmatter parser is simple key-value (no nested YAML). Any key-value pair
can be added, but currently only `audience` is consumed by the system.

### Content Access Model

- `public` audience: visible to all users
- `internal` audience: visible only to users with appropriate role
- Default: inherits from the book's `audience` field

---

## Existing Corpus Structure

11 active books (+ 1 archive directory):

| # | Slug | Title | Sort | Domain |
|---|---|---|---|---|
| 00 | `system-docs` | Studio Ordo System Documentation | 0 | reference, internal |
| I | `second-renaissance` | The Second Renaissance | 1 | teaching, reference |
| II | `identity-system` | The Identity System | 2 | teaching, reference |
| III | `archetype-atlas` | The Archetype Atlas | 3 | teaching, reference |
| IV | `perception-visual-intelligence` | Perception and Visual Intelligence | 4 | teaching, reference |
| V | `trust-proof-persuasion` | Trust, Proof, and Persuasion | 5 | teaching, reference |
| VI | `signal-and-deployment` | Signal and Deployment | 6 | teaching, reference |
| VII | `building-ai-native-systems` | Building AI-Native Systems | 7 | teaching, reference |
| VIII | `formation-and-governance` | Formation and Governance | 8 | teaching, reference |
| IX | `sources-and-lineage` | Sources and Intellectual Lineage | 9 | reference |
| X | `curriculum-architecture` | Curriculum Architecture | 10 | reference, teaching |

---

## Mapping: Old Corpus → New 3-Book Structure

### Book I: The Field Guide
Absorbs and replaces:
- `second-renaissance` (I) → Part I: The Inversion
- `identity-system` (II) → Part II: The Internal Compute
- `archetype-atlas` (III) → Part II: Ch 7 (Outlaw-Sage)
- `perception-visual-intelligence` (IV) → Part III (concepts folded into Signal Stack)
- `trust-proof-persuasion` (V) → Part III: The Signal
- `signal-and-deployment` (VI) → Part III: Ch 10–12
- `formation-and-governance` (VIII) → Part V: The Formation
- `sources-and-lineage` (IX) → The Armory (woven in as briefings)

### Book II: The Operator's Handbook
New content. No direct predecessor in the old corpus. Task-oriented material
that does not currently exist as structured documentation.

### Book III: The Architecture Reference
Absorbs and replaces:
- `system-docs` (00) → expanded and reorganized
- `building-ai-native-systems` (VII) → relevant AI engineering content
- `curriculum-architecture` (X) → structural concepts

---

## Deployment Plan

### New Corpus Directory Structure

```
docs/_corpus/
├── _archive/              # Old books preserved for reference
├── field-guide/           # Book I
│   ├── book.json
│   └── chapters/
│       ├── ch01-the-photograph.md
│       ├── ch02-the-bugatti.md
│       ├── ...
│       └── ch20-the-passage.md
├── operators-handbook/    # Book II
│   ├── book.json
│   └── chapters/
│       ├── ch01-your-first-day.md
│       ├── ...
│       └── ch12-building-your-formation.md
└── architecture-reference/ # Book III
    ├── book.json
    └── chapters/
        ├── ch01-system-invariants.md
        ├── ...
        └── ch11-extension-guide.md
```

### Book Manifests

**Book I:**
```json
{
  "slug": "field-guide",
  "title": "Studio Ordo — The Field Guide for the Human Passage",
  "number": "I",
  "sortOrder": 1,
  "description": "The philosophical thesis, biographical narrative, and intellectual armory for sovereign solopreneurs navigating the AI transition.",
  "domain": ["teaching", "reference"],
  "tags": ["philosophy", "identity", "trust", "signal", "formation", "sovereignty"],
  "audience": "public"
}
```

**Book II:**
```json
{
  "slug": "operators-handbook",
  "title": "The Operator's Handbook",
  "number": "II",
  "sortOrder": 2,
  "description": "Step-by-step operational guide for using the Studio Ordo AI cockpit — from first login through advanced campaign management.",
  "domain": ["teaching", "reference"],
  "tags": ["operations", "crm", "meetup", "campaign", "qr", "getting-started"],
  "audience": "public"
}
```

**Book III:**
```json
{
  "slug": "architecture-reference",
  "title": "The Architecture Reference",
  "number": "III",
  "sortOrder": 3,
  "description": "Deep technical documentation of the Studio Ordo system — architecture, invariants, extension points, and release protocol.",
  "domain": ["reference", "internal"],
  "tags": ["architecture", "sqlite", "docker", "mcp", "capability-catalog", "security"],
  "audience": "public"
}
```

### Migration Steps

1. Archive all existing books to `_archive/` (preserve for reference, not delete)
2. Create three new directories with `book.json` manifests
3. Write all chapters as markdown with `ch##-slug.md` naming convention
4. Verify search index ingests new content correctly
5. Run `npm run quality` and `npm run build` to verify no rendering errors
6. Test search queries: "how do I track my leads?", "what is antifragile?", "how does the job worker retry?"

---

## Technical Capabilities Available for Content

### Generative Tools (for asset production during drafting)

| Tool | Source | Capability |
|---|---|---|
| `eai image` | CLI (pipx) | Generate hero images from text prompts |
| `eai speak` | CLI (pipx) | Generate chapter audio via OpenAI TTS |
| `eai vision` | CLI (pipx) | QA verify generated images via GPT-5 Vision |
| `eai search` | CLI (pipx) | Fact-check claims during QA passes |
| `generate_chart` | Ordo capability | Mermaid/Vega-Lite diagrams |
| `generate_blog_image` | Ordo capability | Blog-style images |
| `compose-media` | Ordo capability | FFmpeg audio/video composition |

### eai Binary Location

```
/Users/kwilliams/.local/pipx/venvs/everydayai-cli/bin/eai
```

Requires `OPENAI_API_KEY` from `.env.local` in the project root.

---

## Constraints and Limitations

1. **Frontmatter is flat key-value only.** No nested YAML, no arrays. If we need tags per chapter, they must go in a different mechanism (or we extend the parser).
2. **Chapter ordering is alphabetical by filename.** Prefix with `ch01-`, `ch02-`, etc.
3. **No image embedding in search index.** Prose is indexed, images are not. Asset placement must be redundant in the prose (describe what the image shows).
4. **Audio files are not served by the corpus system.** Audio delivery will need a separate route or static file serving.
5. **Single-node invariant.** All content lives on disk. No CDN. No external dependencies.

---

*Audited by Claude. Source: `src/adapters/FileSystemCorpusRepository.ts`*
