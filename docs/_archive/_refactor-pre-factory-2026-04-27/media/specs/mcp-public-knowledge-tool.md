# MCP Tool Spec: Public Knowledge Library

**Status:** Draft Spec — Not Yet Implemented  
**Priority:** Phase 2 (after book production)  
**Execution Surface:** MCP (Model Context Protocol)  
**Dependencies:** HTTP client, JSON parsing, text chunking

---

## Purpose

Give the Studio Ordo AI cockpit real-time access to public domain books,
encyclopedic knowledge, and biographical data — so the system can cite
primary sources, pull full-text passages, and answer questions with the
full weight of 2,400 years of recorded human thought.

This is the **Reading Armory as a live service**, not a static file.

---

## Data Sources

### 1. Project Gutenberg (gutenberg.org)
- **What:** 70,000+ free public domain ebooks
- **API:** `https://gutendex.com/books/` (community REST API)
- **Formats:** Plain text, HTML
- **Coverage:** All of classical philosophy, literature, science pre-1927
- **Rate Limits:** Reasonable; no auth required
- **License:** Public domain (all content)

### 2. Wikipedia / Wikimedia
- **What:** Structured encyclopedic knowledge
- **API:** `https://en.wikipedia.org/api/rest_v1/`
- **Formats:** JSON, HTML, plain text summaries
- **Coverage:** Biographical data, historical events, concepts, timelines
- **Rate Limits:** Generous; no auth required with User-Agent header
- **License:** CC BY-SA (summary/citation is fine)

### 3. Open Library (openlibrary.org / Internet Archive)
- **What:** Book metadata, availability, and some full texts
- **API:** `https://openlibrary.org/api/`
- **Formats:** JSON metadata, links to full-text reads
- **Coverage:** Broader than Gutenberg; includes modern metadata
- **Rate Limits:** Moderate; no auth required
- **License:** Varies per book (metadata is open)

### 4. Stanford Encyclopedia of Philosophy (plato.stanford.edu)
- **What:** Peer-reviewed philosophical analysis
- **Formats:** HTML (scrape to markdown)
- **Coverage:** Deep entries on every major philosopher and concept
- **License:** Free for educational use with attribution
- **Note:** No formal API; respectful scraping with caching

---

## MCP Tool Functions

### `search_public_library`

Search for books across Gutenberg and Open Library.

```typescript
interface SearchPublicLibraryInput {
  query: string;          // Author name, title, or subject
  source?: "gutenberg" | "openlibrary" | "all";
  maxResults?: number;    // Default: 5
}

interface SearchPublicLibraryOutput {
  results: {
    title: string;
    author: string;
    year?: number;
    source: "gutenberg" | "openlibrary";
    sourceId: string;     // Gutenberg ID or OL key
    subjects: string[];
    hasFullText: boolean;
    textUrl?: string;     // Direct link to plain text
  }[];
}
```

**Example:** `search_public_library({ query: "Marcus Aurelius" })`

---

### `fetch_book_passage`

Retrieve a specific passage or chapter from a public domain book.
Returns chunked text suitable for AI context windows.

```typescript
interface FetchBookPassageInput {
  sourceId: string;           // From search results
  source: "gutenberg" | "openlibrary";
  section?: string;           // "Book II", "Chapter 3", etc.
  searchWithin?: string;      // Full-text search within the book
  maxTokens?: number;         // Default: 2000
}

interface FetchBookPassageOutput {
  title: string;
  author: string;
  section: string;
  text: string;               // The passage text
  citation: string;           // Formatted citation
  sourceUrl: string;          // Link reader can verify
  publicDomain: boolean;      // Always true for Gutenberg
}
```

**Example:** `fetch_book_passage({ sourceId: "2680", source: "gutenberg", section: "Book V" })`
Returns Meditations Book V with a clean citation.

---

### `lookup_topic`

Search Wikipedia for structured knowledge about a person, event, or concept.

```typescript
interface LookupTopicInput {
  topic: string;              // "Stoicism", "Marcus Aurelius", "Printing Press"
  sections?: string[];        // Specific sections: ["Biography", "Philosophy"]
  maxLength?: "summary" | "full";  // Default: "summary"
}

interface LookupTopicOutput {
  title: string;
  summary: string;            // 2-3 paragraph summary
  sections?: {
    heading: string;
    content: string;
  }[];
  infobox?: Record<string, string>;  // Structured data (born, died, etc.)
  citations: string[];         // Source URLs
  relatedTopics: string[];     // Links to explore further
}
```

**Example:** `lookup_topic({ topic: "Fourth Turning theory" })`

---

### `lookup_biography`

Specialized biographical lookup — returns structured life data.

```typescript
interface LookupBiographyInput {
  name: string;
  focus?: "life" | "works" | "influence" | "all";
}

interface LookupBiographyOutput {
  name: string;
  born: string;
  died?: string;
  occupation: string[];
  notableWorks: string[];
  summary: string;
  keyQuotes?: string[];        // Sourced from Wikiquote if available
  historicalContext: string;   // Era, contemporaries, movements
  citation: string;
}
```

**Example:** `lookup_biography({ name: "Seneca the Younger", focus: "works" })`

---

### `cite_source`

Generate a properly formatted citation for any source.

```typescript
interface CiteSourceInput {
  sourceType: "book" | "article" | "encyclopedia" | "speech";
  title: string;
  author: string;
  year?: number;
  translator?: string;
  publisher?: string;
  url?: string;
  format?: "mla" | "apa" | "chicago" | "inline";  // Default: "inline"
}

interface CiteSourceOutput {
  citation: string;
  shortCite: string;          // e.g., "(Aurelius, Med. V.1)"
  isPublicDomain: boolean;
  canQuoteFreely: boolean;
}
```

---

## Integration with Studio Ordo

### Chat Flow Example

```
USER: "I'm scared about my first meetup tomorrow."

SYSTEM (internal):
  1. search_corpus("meetup anxiety first time") → finds Part III, Ch. 7
  2. fetch_book_passage({ search: "bear with them", source: "gutenberg",
     sourceId: "2680" }) → finds Med. II.1
  3. Compose response with both sources

RESPONSE:
  "The Architect wrote about this in Chapter 7 — the analog handshake
  is the only thing that separates you from everyone else who stays home.

  Marcus Aurelius faced worse every morning:
  'Remember to put yourself in mind every morning, that before night
  it will be your luck to meet with some busy-body, with some ungrateful,
  abusive fellow... and since I am satisfied the person disobliging is of
  kin to me... I am likewise convinced that no man can do me a real injury,
  because no man can force me to misbehave myself.'

  He wrote that while commanding 140,000 soldiers on the Danube frontier.
  You're going to a meetup. You've got this."
```

### Capability Catalog Entry

```typescript
{
  id: "public_knowledge_library",
  family: "research",
  label: "Public Knowledge Library",
  description: "Search and retrieve passages from public domain books, encyclopedias, and biographical sources. Access 70,000+ free books and the full breadth of encyclopedic knowledge.",
  executionSurface: "mcp",
  schemaFacet: { /* input/output schemas above */ },
  tags: ["research", "citation", "public-domain", "philosophy", "history"],
}
```

---

## Caching Strategy

- **Book texts:** Cache full-text downloads in SQLite blob storage.
  A downloaded Gutenberg text never needs to be fetched again.
- **Wikipedia summaries:** Cache with 7-day TTL (content updates).
- **Search results:** Cache with 24-hour TTL.
- **Cache key:** `source:id:section` or `topic:language:length`

This makes the tool fast after first use and respectful to source APIs.

---

## Copyright Safety

| Source | License | Can Quote? | Can Cache? | Can Include in Audio? |
|---|---|---|---|---|
| Project Gutenberg | Public Domain | ✅ Unlimited | ✅ Yes | ✅ Yes |
| Wikipedia | CC BY-SA | ✅ With attribution | ✅ Yes | ✅ With attribution |
| Open Library metadata | Open | ✅ Metadata only | ✅ Yes | N/A |
| Stanford Encyclopedia | Free/Educational | ✅ With attribution | ⚠️ Limited | ⚠️ Fair use |

The tool enforces a `publicDomain` flag on every response.
The system prompt instructs the AI to only quote freely from public domain sources,
and to use fair-use guidelines for everything else.

---

## Implementation Notes

- Register as a single MCP tool with sub-commands, or as 5 separate tools
  (the catalog already supports both patterns via `schemaFacet`)
- Use the existing `deferred-job-worker` for background book downloads
  (a full Gutenberg text can be large — download and cache async)
- Text chunking should respect chapter/section boundaries,
  not arbitrary token counts
- All cached content lives in the existing SQLite database —
  no new infrastructure required (single-node invariant preserved)

---

*Spec drafted by Claude. To be implemented after the book production program.*
*This tool turns the Reading Armory from a static file into a living library.*
