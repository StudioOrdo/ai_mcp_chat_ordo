# Chapter 6 — Screen Reader Engineering: Semantic HTML and ARIA

## Abstract

Screen readers convert visual interfaces to auditory experiences. This chapter covers the Document Accessibility Model, semantic HTML as the foundation, ARIA landmarks, live regions, and the testing discipline of regular screen reader verification.

---

## The Accessibility Tree

Browsers construct a parallel DOM called the **accessibility tree**. Screen readers read this tree, not the visual DOM. Semantic HTML elements (`<button>`, `<nav>`, `<h1>`, `<label>`) populate the accessibility tree automatically. Non-semantic elements (`<div>`, `<span>`) are invisible unless explicitly annotated with ARIA.

### ARIA Landmarks

- `role="banner"` → site header
- `role="navigation"` → nav menus
- `role="main"` → primary content
- `role="contentinfo"` → footer
- `role="search"` → search functionality

### Live Regions

Dynamic content (toast notifications, form validation messages, chat messages) requires `aria-live` to announce changes to screen reader users.

## Chapter Checklist

- Is every interactive element built with semantic HTML or properly ARIA-annotated?
- Do landmark roles cover the major page regions?
- Are dynamic content changes announced via `aria-live` regions?

---
