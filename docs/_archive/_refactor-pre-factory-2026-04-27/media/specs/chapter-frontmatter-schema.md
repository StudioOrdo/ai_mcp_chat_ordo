# Feature Spec: Chapter Frontmatter Schema

**Status:** Draft Spec — Not Yet Implemented
**Priority:** Phase 1 (concurrent with corpus scaffold)
**Execution Surface:** Corpus repository, search indexer, SEO generation
**Dependencies:** `FileSystemCorpusRepository.ts`, `library-metadata.ts`, `CorpusIndexInteractor.ts`

---

## Purpose

Each chapter's YAML frontmatter becomes a **machine-readable spec** that feeds three systems simultaneously:
1. **Search engine** — richer metadata for chunk scoring and result display
2. **Journal pipeline** — pre-written article briefs for `produce_blog_article`
3. **SEO generation** — precise meta descriptions and keywords instead of content extraction

---

## Schema

```yaml
---
# Required
title: "The Photograph"
audience: public                    # public | authenticated | staff | admin

# Voice & Narrative
voice: architect                    # architect | machine | dialogue
emotional_beat: fear                # single word: fear, wonder, anger, etc.
pillar: inversion                   # content pillar ID for journal mapping

# Reading Armory
armory:
  - key: fourth-turning
    type: briefing                  # briefing | full-passage
    citation: "Strauss & Howe — The Fourth Turning (1997)"
    note: "The 80-year cycle thesis applied to the AI transition"

# Hope Line (closing sentence)
hope_line: >
  The horse economy ended in 13 years. But someone built the automobile.
  Part IV shows you the automobile.

# Journal Seeds (articles this chapter spawns)
journal_seeds:
  - brief: "Why 13 years is all you get"
    section: essay
    target_audience: "Mid-career professionals sensing the shift"
    objective: "Drive traffic to the full chapter"
    tone: "urgent, evidence-backed, accessible"
  - brief: "The 5th Avenue test for your career"
    section: briefing
    target_audience: "Solopreneurs evaluating market position"

# SEO
seo:
  description: >
    Paradigm shifts happen in 13 years. The AI transition is following
    the same pattern as the horse-to-automobile transition of 1900-1913.
  keywords:
    - paradigm shift
    - AI transition
    - career change
    - solopreneur

# Contributors (for practitioner index)
contributors:
  - Keith Williams
  - Claude
---
```

---

## Field Definitions

### Required Fields

| Field | Type | Description |
|---|---|---|
| `title` | string | Chapter display title |
| `audience` | enum | Access control level — maps to `ContentAudience` |

### Voice & Narrative

| Field | Type | Default | Description |
|---|---|---|---|
| `voice` | enum | `dialogue` | Primary narrator for this chapter |
| `emotional_beat` | string | — | What the reader should FEEL at the end |
| `pillar` | string | — | Content pillar ID for journal mapping |

### Reading Armory

```yaml
armory:
  - key: string        # Slug-safe identifier
    type: string        # "briefing" (summary) or "full-passage" (extended quote)
    citation: string    # Human-readable citation
    note: string        # Optional context for why this reference matters
```

### Journal Seeds

```yaml
journal_seeds:
  - brief: string       # Content brief for produce_blog_article
    section: string     # "essay" or "briefing"
    target_audience: string  # Target reader description (NOT "audience" — collides with top-level access field)
    objective: string   # Business objective
    tone: string        # Editorial tone
```

> **⚠️ Parser Note:** The current `parseFrontmatter()` is a flat `key: value` parser.
> It does NOT understand YAML nesting. Using `audience:` inside `journal_seeds` will
> overwrite the top-level `audience: public` and break content access control.
> Use `target_audience` for the nested field until the parser is upgraded.

### SEO

```yaml
seo:
  description: string   # Meta description (max 160 chars recommended)
  keywords: string[]    # SEO keywords
```

---

## Integration Points

### 1. FileSystemCorpusRepository

**File:** `src/adapters/FileSystemCorpusRepository.ts`

The repository already parses YAML frontmatter from chapter files. Extend the `Section` entity to carry the new fields:

```typescript
// Add to Section entity or make available through the index
interface ChapterMetadata {
  voice?: "architect" | "machine" | "dialogue";
  emotionalBeat?: string;
  pillar?: string;
  hopeLine?: string;
  armory?: ArmoryEntry[];
  journalSeeds?: JournalSeed[];
  seo?: {
    description?: string;
    keywords?: string[];
  };
}
```

### 2. CorpusIndexInteractor

**File:** `src/core/use-cases/CorpusIndexInteractor.ts`

Extend `CorpusIndexEntry` to include pillar and voice:

```typescript
export interface CorpusIndexEntry {
  // ... existing fields ...
  voice?: "architect" | "machine" | "dialogue";
  pillar?: string;
  emotionalBeat?: string;
}
```

### 3. SEO Generation

**File:** `src/lib/seo/library-metadata.ts`

Use `seo.description` from frontmatter instead of `extractDescription()`:

```typescript
export function buildChapterSeo(input: ChapterMetadataInput): ChapterSeo {
  // Prefer frontmatter description over content extraction
  const description = input.seoDescription
    ?? extractDescription(input.content);
  // ...
}
```

### 4. Search Results

**File:** `src/core/use-cases/tools/CorpusTools.ts`

Search results can include voice attribution and pillar classification, enabling the chat to say:
- "The Architect discusses this in Chapter 6 (The Dart)..."
- "The Machine explains the architecture in Chapter 14..."

---

## Backward Compatibility

All new fields are optional. Existing chapters without the extended frontmatter continue to work exactly as they do today. The schema is additive — no breaking changes.

---

## Test Cases

1. **Parsing:** Chapter with full frontmatter correctly populates all metadata fields
2. **Parsing:** Chapter with minimal frontmatter (title + audience only) works unchanged
3. **SEO:** Chapter with `seo.description` uses it instead of content extraction
4. **SEO:** Chapter without `seo.description` falls back to `extractDescription()`
5. **Index:** `CorpusIndexEntry` includes `voice` and `pillar` when present
6. **Search:** Search results for voice-attributed chunks include voice metadata

---

*Spec drafted by Claude. For implementation by a separate engineering agent.*
