# Chapter 3 — Visual Accessibility: Color, Contrast, and Typography

## Abstract

26% of US adults have some form of visual disability. This chapter covers the engineering implementation of visual accessibility: color contrast (WCAG AA/AAA), color independence, text scaling, dark mode, and high-contrast mode support.

---

## Core Requirements

### Color Contrast

WCAG 2.1 requires minimum contrast ratios:

- **4.5:1** for normal text (AA)
- **3:1** for large text (AA)
- **7:1** for normal text (AAA)

### Color Independence

Information must not rely solely on color. A form field with a red border is inaccessible if the border *only* changes color — it should also add an icon, text label, or pattern change.

### Text Scaling

Users who set their browser to 200% zoom should still be able to use the product. This means using relative units (rem, em) rather than fixed pixels.

## Chapter Checklist

- Do all text/background combinations meet WCAG AA contrast (4.5:1)?
- Is information conveyed by color also conveyed by another visual channel?
- Does your layout work at 200% browser zoom?

---
