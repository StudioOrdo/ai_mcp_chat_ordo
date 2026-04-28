# Chapter 7 — Accessibility Testing: Automated, Manual, and User

## Abstract

Automated tools catch ~30% of accessibility issues. The rest require manual testing and, ideally, testing with actual users who have disabilities. This chapter covers the layered testing approach, tool selection, and organizational testing cadence.

---

## The Testing Pyramid

| Layer | Tools | Catches |
| ------- | ------- | --------- |
| Automated | axe-core, Lighthouse, WAVE | Missing alt text, low contrast, missing labels (~30%) |
| Semi-automated | Browser DevTools, aXe DevTools | Focus order, ARIA usage, reading order |
| Manual | Keyboard testing, screen reader testing | Interaction flows, comprehension, navigation logic |
| User testing | Participants with disabilities | Real-world workflow issues, cognitive barriers |

## Chapter Checklist

- Is accessibility testing integrated into your CI/CD pipeline?
- Do you test with a screen reader at least once per sprint?
- Have you conducted accessibility testing with users who have disabilities?

---
