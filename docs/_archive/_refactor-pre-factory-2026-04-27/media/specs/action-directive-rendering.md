# Feature Spec: Action Directive Rendering

**Status:** Draft Spec — Not Yet Implemented
**Priority:** Phase 2 (after voice directives)
**Execution Surface:** Client-side rendering + Chat integration
**Dependencies:** `MarkdownProse.tsx`, `ChatProvider` / `useGlobalChat` hook

---

## Purpose

Turn passive reading into active system use. When readers encounter a concept in a chapter, they can click an inline action that sends a message to the chat — without leaving the page or losing their reading position.

The existing `?topic=` link at the bottom of each chapter (`"Have questions about this chapter? Ask the AI."`) is the seed of this pattern. Action directives make it **granular** — every chapter has 1–3 specific actions embedded in the prose at the point where they're most relevant.

---

## Content Convention

Use the existing blockquote directive pattern:

```markdown
> [!action send="Map my archetype using the identity system"]
> Try mapping your own identity layers right now.
```

### Parameters

| Parameter | Required | Description |
|---|---|---|
| `send` | Yes | The message to send to the chat when clicked |

### Examples

```markdown
## Chapter 7: The Outlaw-Sage

The archetype framework identifies twelve core patterns...

> [!action send="Help me identify my primary archetype"]
> Try it: Ask the AI to walk you through the archetype assessment.

The Architect's own archetype is the Outlaw-Sage...
```

```markdown
## Chapter 15: The $10 Sovereignty Stack

The system runs on a single SQLite database...

> [!action send="Show me my current system architecture"]
> See it live: Ask the cockpit to show you what's running right now.
```

---

## Implementation

### 1. MarkdownProse.tsx — Rendering

**File:** `src/components/MarkdownProse.tsx`
**Function:** `parseDirective()`

Add action parsing:

```typescript
const actionMatch = normalized.match(/^\[!action\s+send="([^"]+)"\]\s*/i);
if (actionMatch) {
  return {
    kind: "action" as const,
    sendMessage: actionMatch[1],
    content: normalized.slice(actionMatch[0].length).trim(),
  };
}
```

**New Component:**

```tsx
function ChapterAction({
  sendMessage,
  children,
}: {
  sendMessage: string;
  children: React.ReactNode;
}) {
  const { sendMessage: chatSend } = useGlobalChat();

  return (
    <button
      className="chapter-action-pill"
      onClick={() => chatSend(sendMessage)}
      data-chapter-action="true"
      type="button"
    >
      <span className="chapter-action-icon">→</span>
      <span className="chapter-action-text">{children}</span>
    </button>
  );
}
```

**CSS (suggested):**

```css
.chapter-action-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--accent-interactive);
  border-radius: 2rem;
  background: transparent;
  color: var(--accent-interactive);
  font-family: var(--font-label);
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 200ms ease;
  margin-block: var(--space-4);
}

.chapter-action-pill:hover {
  background: var(--accent-interactive);
  color: var(--surface);
  transform: translateY(-1px);
}

.chapter-action-icon {
  font-size: 0.9em;
  transition: transform 200ms ease;
}

.chapter-action-pill:hover .chapter-action-icon {
  transform: translateX(2px);
}
```

### 2. Chat Integration

The `ChapterAction` component needs access to `useGlobalChat()`. Since `MarkdownProse` is used inside the library page, and the `ChatProvider` wraps the entire app in `layout.tsx`, the hook is already available in the component tree.

**Consideration:** `MarkdownProse` is currently a pure rendering component with no client-side interactivity. Adding `useGlobalChat()` requires making the action component a client component. Options:
- **Option A (recommended):** Extract `ChapterAction` as a separate client component, rendered inside `MarkdownProse` via the `blockquote` override. The rest of `MarkdownProse` stays server-renderable.
- **Option B:** Make the entire `MarkdownProse` component client-side. Not recommended — it works fine as a server component today.

### 3. Anonymous Users

Anonymous users can see the action pills but clicking them should:
1. Open the chat FAB (if closed)
2. Pre-fill the message
3. The chat's existing role-based behavior handles the rest (anonymous gets limited tool access)

---

## Test Cases

1. **Rendering:** `[!action]` blockquote renders as a clickable pill
2. **Click behavior:** Clicking sends the `send` message to the chat
3. **Chat opens:** If the floating chat is closed, clicking the pill opens it
4. **Anonymous:** Anonymous users can click and the chat responds within demo scope
5. **Accessibility:** The pill is keyboard-navigable and has appropriate `aria-label`
6. **Mobile:** The pill is touch-target compliant (min 44px)
7. **Journal variant:** Action directives do NOT render in journal articles (journal content is standalone)

---

## Constraints

- Action directives ONLY appear in library corpus content
- Maximum 3 action directives per chapter (editorial constraint, not technical)
- The `send` message must be < 200 characters
- Action pills must not break the reading flow — they are inline suggestions, not interruptions

---

*Spec drafted by Claude. For implementation by a separate engineering agent.*
