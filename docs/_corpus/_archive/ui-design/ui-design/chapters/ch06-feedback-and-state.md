# Chapter 6 — Feedback and State: Making the Invisible Visible

## Abstract

Every system has state. The user's job is to understand that state. The interface's job is to make that state visible. This chapter traces feedback design from Don Norman's *The Design of Everyday Things* through loading patterns, error hierarchies, optimistic UI, and the modern reality of streaming, skeleton screens, and real-time state synchronization. The principle: **if the system changed state and the user didn't notice, the interface failed.**

---

## Don Norman and Feedback Gaps (1988)

**Don Norman** published *The Design of Everyday Things* in 1988, introducing concepts that became foundational to interaction design:

### The Gulf of Execution and the Gulf of Evaluation

Norman identified two gaps between users and systems:

- **Gulf of Execution**: the distance between what the user *wants to do* and what the interface *allows them to do*
- **Gulf of Evaluation**: the distance between the system's *actual state* and the user's *understanding* of that state

Feedback bridges the Gulf of Evaluation. If the user clicks "Submit" and nothing visibly happens, the gulf widens — the user doesn't know if the system received the input, is processing it, succeeded, or failed.

### The Four Feedback States

Every interactive element should communicate these states:

| State | Visual Treatment | ARIA |
| ------- | ----------------- | ------ |
| Default | Base styling | — |
| Loading | Spinner, skeleton, disabled input | `aria-busy="true"` |
| Success | Confirmation message, checkmark, color shift | `role="status"` |
| Error | Error message, border highlight, icon | `role="alert"`, `aria-invalid="true"` |

**What frustrated him:** Doors that looked identical whether they should be pushed or pulled. His principle: *make the state of the system visible.* This applies to every interactive element in digital interfaces.

---

## Loading Patterns: Skeleton Screens vs. Spinners

A loading spinner tells the user: "something is happening." A **skeleton screen** tells the user: "here is what will appear, and here is approximately where it will appear." Skeletons are superior for perceived performance because they set spatial expectations.

```css
/* Skeleton loading: spatial placeholder with animation */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-subtle) 25%,
    var(--color-surface-muted) 50%,
    var(--color-surface-subtle) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-md);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Optimistic UI

For operations that almost always succeed (toggling a like, adding to a list), **optimistic UI** updates the interface immediately before the server confirms. If the server fails, the interface rolls back.

This technique reduces perceived latency to zero for common operations. The tradeoff: occasional rollbacks that can be disorienting if not handled carefully.

---

## Error Hierarchies

Not all errors are equal. A type error in a form field is informational. A failed payment is critical. A network timeout is systemic. Each severity requires different treatment:

| Severity | Treatment | Duration |
| ---------- | ----------- | ---------- |
| Informational | Inline hint (below field) | Persistent until corrected |
| Warning | Banner with dismiss action | Until dismissed |
| Error | Inline + summary (top of form) | Persistent until corrected |
| Critical | Modal dialog blocking interaction | Until acknowledged |
| Systemic | Full-page error state | Until resolved |

The principle: error severity should map to visual weight. An error that prevents the user from continuing should be visually dominant. A suggestion that the user *might* want to reconsider should be subtle.

---

## What This Means for Us

Feedback is the interface's voice. It communicates what happened, what's happening now, and what to do next. Without feedback, the interface is a black box — the user presses buttons in the dark and hopes.

## Chapter Checklist

- Does every interactive element communicate loading, success, and error states?
- Are loading states spatial (skeletons) rather than abstract (spinners) where content layout is predictable?
- Is your error hierarchy stratified by severity (informational → critical)?
- Do critical errors block interaction? Do informational errors avoid blocking?
- Does your feedback system work for screen readers (`aria-busy`, `role="alert"`, `aria-live`)?
