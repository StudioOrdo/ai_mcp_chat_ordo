# Feature Spec: Voice Directive Rendering

**Status:** Draft Spec — Not Yet Implemented
**Priority:** Phase 1 (before first chapter draft)
**Execution Surface:** Client-side rendering + Search indexing
**Dependencies:** `MarkdownProse.tsx`, `MarkdownChunker.ts`, `SearchChunkMetadata`

---

## Purpose

Make the dual-voice narrative device (Architect / Machine) a **first-class system primitive** — visible to the renderer, the search engine, and the chunk metadata pipeline. Currently, voice markers are HTML comments (`<!-- voice: architect -->`) that the system cannot see.

---

## Content Convention

Use the existing blockquote directive pattern (`[!pullquote]`, `[!sidenote]`) established in the journal system.

### Architect Voice
```markdown
> [!architect]
> When I was five years old, a dart went through my right eye.
> No preamble. No setup. The reader's attention is seized.
```

### Machine Voice
```markdown
> [!machine]
> The system he would build three years later runs on a single SQLite
> database. The irony is precise: the man who had to relearn how to
> communicate built a communication system.
```

### Multi-paragraph Voice Blocks
```markdown
> [!architect]
> First paragraph of the Architect speaking.
>
> Second paragraph, still the Architect's voice. The directive applies
> to the entire blockquote.
```

### Regular Blockquotes
Standard blockquotes (without directives) render normally — no voice attribution:
```markdown
> "Do not act as if you had ten thousand years to throw away."
> — Marcus Aurelius
```

---

## Implementation

### 1. MarkdownProse.tsx — Rendering

**File:** `src/components/MarkdownProse.tsx`
**Function:** `parseDirective()`

Add `architect` and `machine` to the directive parser:

```typescript
function parseDirective(text: string) {
  const normalized = text.trim();
  const pullQuoteMatch = normalized.match(/^(?:\[!pullquote\]|pull\s*quote:)\s*/i);
  const sideNoteMatch = normalized.match(/^(?:\[!sidenote\]|\[!side-note\]|side\s*note:)\s*/i);
  const architectMatch = normalized.match(/^\[!architect\]\s*/i);
  const machineMatch = normalized.match(/^\[!machine\]\s*/i);

  // ... existing pullquote/sidenote handling ...

  if (architectMatch) {
    return {
      kind: "architect" as const,
      content: normalized.slice(architectMatch[0].length).trim(),
    };
  }

  if (machineMatch) {
    return {
      kind: "machine" as const,
      content: normalized.slice(machineMatch[0].length).trim(),
    };
  }

  return null;
}
```

**New Components:**

```typescript
// Architect voice — warm, human, serif-adjacent
function VoiceArchitect({ children }: { children: React.ReactNode }) {
  return (
    <div className="voice-block voice-architect" data-voice="architect">
      <div className="voice-label">The Architect</div>
      <div className="voice-content">{children}</div>
    </div>
  );
}

// Machine voice — cool, precise, monospace-inflected
function VoiceMachine({ children }: { children: React.ReactNode }) {
  return (
    <div className="voice-block voice-machine" data-voice="machine">
      <div className="voice-label">The Machine</div>
      <div className="voice-content">{children}</div>
    </div>
  );
}
```

**CSS (suggested):**

```css
.voice-block {
  position: relative;
  margin-block: var(--space-6);
  padding: var(--space-4) var(--space-6);
  border-radius: 1rem;
}

.voice-architect {
  border-left: 3px solid var(--accent-warm, #c4956a);
  background: color-mix(in oklab, var(--surface) 97%, var(--accent-warm, #c4956a));
}

.voice-machine {
  border-left: 3px solid var(--accent-cool, #6a8fc4);
  background: color-mix(in oklab, var(--surface) 97%, var(--accent-cool, #6a8fc4));
  font-family: var(--font-ibm-plex-mono);
  font-size: 0.95em;
}

.voice-label {
  font-family: var(--font-label);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  opacity: 0.6;
  margin-bottom: var(--space-2);
}
```

### 2. MarkdownChunker.ts — Search Metadata

**File:** `src/core/search/MarkdownChunker.ts`
**Method:** `splitPreservingAtomicBlocks()`

Blockquotes are already preserved as atomic blocks. Add voice detection when a blockquote starts with `[!architect]` or `[!machine]`:

```typescript
// In the chunk metadata extraction, after splitting:
function detectVoiceDirective(block: string): "architect" | "machine" | null {
  const firstLine = block.split("\n")[0]?.replace(/^>\s*/, "").trim() ?? "";
  if (/^\[!architect\]/i.test(firstLine)) return "architect";
  if (/^\[!machine\]/i.test(firstLine)) return "machine";
  return null;
}
```

### 3. SearchChunkMetadata — Voice Field

**File:** `src/core/search/ports/Chunker.ts`

Add optional voice field to chunk metadata:

```typescript
export interface SearchChunkMetadata {
  headingPath: string[];
  documentSlug: string;
  sectionSlug: string;
  // ... existing fields ...
  voice?: "architect" | "machine";  // NEW
}
```

This allows the search engine to return voice-attributed results. The chat system can tell the user "The Architect said X in Chapter 6" vs "The Machine explains X in Chapter 14."

---

## Test Cases

1. **Rendering:** `[!architect]` blockquote renders with warm border and "The Architect" label
2. **Rendering:** `[!machine]` blockquote renders with cool border and "The Machine" label
3. **Rendering:** Standard blockquote (no directive) renders unchanged
4. **Rendering:** Multi-paragraph voice block renders as single styled unit
5. **Chunker:** Voice blockquote chunk includes `voice: "architect"` in metadata
6. **Chunker:** Regular blockquote chunk has `voice: undefined`
7. **Journal variant:** Voice directives render correctly in `variant="journal"` mode

---

## Constraints

- Voice directives ONLY appear in library corpus content, not in journal articles or chat responses
- The rendering must degrade gracefully in non-visual contexts (RSS, plain text) — the content is still readable without styling
- Voice labels should be screenreader-accessible (use `aria-label`)
- Dark mode must work — the background colors use `color-mix` with the current surface

---

*Spec drafted by Claude. For implementation by a separate engineering agent.*
