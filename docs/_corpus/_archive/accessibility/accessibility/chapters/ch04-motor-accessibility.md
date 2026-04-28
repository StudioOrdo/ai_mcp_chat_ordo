# Chapter 4 — Motor Accessibility: Keyboard, Switch, and Voice

## Abstract

Motor accessibility ensures that users who cannot use a mouse — whether due to permanent disability, temporary injury, or situational constraint — can operate the interface. This chapter covers keyboard navigation, focus management, switch access, and voice control.

---

## Keyboard Navigation Patterns

Every interactive element must be:

- **Reachable**: accessible via Tab / Shift+Tab
- **Activatable**: triggerable via Enter or Space
- **Escapable**: dismissible via Escape (for modals, dropdowns, tooltips)

Focus order must follow a logical reading order. Custom focus management (using `tabindex`) should be used sparingly — semantic HTML provides correct focus order automatically.

## Chapter Checklist

- Can every interactive element be reached and activated via keyboard?
- Is there a visible focus indicator on every focusable element?
- Can modals, dropdowns, and tooltips be closed with Escape?
- Does Tab order follow the visual reading order?

---
