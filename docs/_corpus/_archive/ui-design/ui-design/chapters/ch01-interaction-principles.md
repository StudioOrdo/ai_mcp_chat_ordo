# Chapter 1 — Interaction Principles: Engelbart, Raskin, and the Humane Interface

## Abstract

Before there were design systems, there were interaction principles — fundamental rules about how humans perceive, process, and control digital systems. This chapter traces the lineage from Doug Engelbart's 1968 "Mother of All Demos" through Jef Raskin's *The Humane Interface*, Larry Tesler's war on modes, and Ben Shneiderman's Eight Golden Rules. Together, they established the invariants that every successful interface obeys.

---

## Doug Engelbart and the Mother of All Demos (1968)

**Doug Engelbart** was a radar technician turned vision architect. In 1962, he wrote *Augmenting Human Intellect: A Conceptual Framework*, arguing that computers could amplify human cognitive capability — not replace it, but *augment* it.

On December 9, 1968, at the Fall Joint Computer Conference in San Francisco, Engelbart gave what is now called the "Mother of All Demos." In ninety minutes, he demonstrated:

- A mouse (the first public use)
- Hypertext (clickable links between documents)
- Windowed displays
- Real-time collaborative editing (two people editing the same document simultaneously, in different cities)
- Version control for documents
- Dynamic file linking

Every major interface paradigm — from the Macintosh GUI to Google Docs to GitHub — descends from that ninety minutes.

Engelbart's key principle: **the interface is an augmentation tool, not a simplification tool.** He was not trying to make computers easy. He was trying to make humans *more capable*. The system he built (NLS, oN-Line System) was complex to learn but extraordinarily powerful once mastered. It rewarded investment. It amplified skill.

This is the origin of the tension that runs through all UI design: accessibility (easy to learn) versus power (capable of complex operations). Every interface sits somewhere on this spectrum, and the designer's job is to choose the right position for the right audience.

**What frustrated him:** The reduction of his vision to "the guy who invented the mouse." He invented a *system for augmenting human intellect*. The mouse was the least interesting part.

---

## Jef Raskin and the Humane Interface (2000)

**Jef Raskin** started the Macintosh project at Apple in 1979. His vision was an "information appliance" — a computer so simple that no training was required. When Steve Jobs took over the project and steered it toward a more complex (and commercially successful) direction, Raskin left and spent the rest of his career pursuing his original vision.

His 2000 book *The Humane Interface* codified principles that are now fundamental to UI engineering:

### Habituation and Automaticity

Raskin observed that users develop habits through repeated interaction. Once a habit forms, it becomes automatic — the user acts without conscious thought. This has two implications:

1. **Consistent interfaces are learnable**: If a button always appears in the same location and always does the same thing, the user habituates quickly and their interaction becomes automatic.
2. **Inconsistent interfaces are dangerous**: If the same gesture sometimes does one thing and sometimes does another, the habituated user will execute the wrong action confidently, without noticing.

This is why **consistent component APIs** matter in design systems. A `<Button>` component that sometimes triggers navigation and sometimes triggers a modal — without visual differentiation — will cause habituated users to make errors.

### The Locus of Attention

Raskin introduced the concept of a singular attention focus: users can only attend to one thing at a time. If a system changes state outside the user's locus of attention, they will not notice. This is why inline validation (showing errors next to the field) is more effective than alert boxes (which appear outside the user's focus).

Modern translation: **toast notifications** work for confirmation. They fail for critical errors, because users habituate to dismissing them.

**What frustrated him:** Interfaces that required training to use. He believed any interface that needed a manual was a failed design.

---

## Larry Tesler and the War on Modes (1980s)

**Larry Tesler** was a researcher at Xerox PARC and later Apple. He dedicated much of his career to a single principle: **no modes**.

A "mode" is a state where the same input produces different outputs. In the Unix text editor `vi`, pressing "i" in normal mode inserts text, but pressing "i" while already in insert mode types the letter "i." The user must track which mode they're in, and mode confusion causes errors.

Tesler's license plate literally read "NO MODES." He argued that modeless interfaces — where every input has one consistent meaning — are fundamentally more humane.

Modern interfaces have not eliminated modes entirely (dark mode, edit mode, preview mode all exist), but Tesler's principle evolved into a design heuristic: **if a mode is necessary, it must be visually obvious.** The user must always know which mode they're in, because the interface makes the current mode visible.

In component engineering, this translates to explicit visual state management:

```css
/* Mode must be visible — not just logical */
.editor--preview {
  background-color: var(--color-surface-muted);
  pointer-events: none;
  opacity: 0.85;
}

.editor--editing {
  background-color: var(--color-surface-primary);
  pointer-events: auto;
  opacity: 1;
}
```

**What frustrated him:** Interfaces where the user could not determine the system's current state by looking at the screen.

---

## Ben Shneiderman and the Eight Golden Rules (1986)

**Ben Shneiderman** published *Designing the User Interface* in 1986, establishing eight principles that became the standard heuristic framework for interface evaluation:

1. **Strive for consistency**: uniform actions, terminology, layout, color, and typography
2. **Cater to universal usability**: accommodate novice through expert
3. **Offer informative feedback**: every action should produce a visible system response
4. **Design dialogs to yield closure**: sequences of actions should have a clear beginning, middle, and end
5. **Prevent errors**: design to make errors impossible, not just recoverable
6. **Permit easy reversal of actions**: undo reduces anxiety and encourages exploration
7. **Keep users in control**: experienced users should feel the system responds to their actions, not the reverse
8. **Reduce short-term memory load**: display information rather than requiring users to remember it

### Mapping to Component Engineering

| Rule | Component Implementation |
| ------ | ------------------------ |
| Consistency | Design tokens, component APIs, naming conventions |
| Universal usability | Keyboard navigation, screen reader support, responsive layout |
| Informative feedback | Loading states, success/error indicators, progress bars |
| Dialog closure | Multi-step forms with progress indicators and confirmation screens |
| Error prevention | Input validation, disabled states, type constraints |
| Easy reversal | Undo functionality, confirmation dialogs for destructive actions |
| User control | Customizable settings, keyboard shortcuts, escape-to-close |
| Reduce memory load | Inline help, visible options, autocomplete |

**What frustrated him:** Interfaces that were designed for engineers rather than users — systems that exposed internal complexity rather than managing it on the user's behalf.

---

## What This Means for Us

These four practitioners established the interaction invariants that every modern interface must obey:

- **Engelbart**: the interface augments human capability
- **Raskin**: the interface respects human cognition (habituation, attention)
- **Tesler**: the interface is modeless or makes modes explicit
- **Shneiderman**: the interface follows systematic, verifiable rules

A component library that violates these principles will produce polished UIs that frustrate users. A component library that honors them will produce UIs that feel invisible — the highest compliment in interaction design.

## Repository Example: Feedback and State

In our Next.js application, every interactive component implements Shneiderman's "informative feedback" rule:

```tsx
function SubmitButton({ isLoading, isSuccess, isError }) {
  return (
    <button
      disabled={isLoading}
      aria-busy={isLoading}
      aria-live="polite"
      className={`btn ${isSuccess ? 'btn--success' : ''} ${isError ? 'btn--error' : ''}`}
    >
      {isLoading && <Spinner />}
      {isSuccess && '✓ Saved'}
      {isError && '✗ Failed — Try Again'}
      {!isLoading && !isSuccess && !isError && 'Submit'}
    </button>
  );
}
```

The button communicates four states: default, loading, success, and error. The `aria-busy` and `aria-live` attributes communicate these states to screen readers. No user should ever click a button and see nothing happen.

## Chapter Checklist

- Does every interactive element provide visible feedback on interaction?
- Are your components modeless, or do they make their current mode visually explicit?
- Can a user undo any non-destructive action?
- Does your interface respect the user's locus of attention (errors shown where the user is looking)?
- Are your interaction patterns consistent across the entire application?
