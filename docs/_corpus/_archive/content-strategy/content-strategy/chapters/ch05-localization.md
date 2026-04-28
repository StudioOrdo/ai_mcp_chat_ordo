# Chapter 5 — Localization: Content Across Cultures

## Abstract

Localization is not translation. It is the adaptation of content for different cultural contexts. This chapter covers internationalization engineering, cultural adaptation, and the discipline of designing content systems that support multiple languages.

## Key Engineering Decisions

- **Externalize all strings**: no hardcoded text in components
- **Support text expansion**: German text is ~30% longer than English; layouts must accommodate
- **RTL support**: Arabic and Hebrew require right-to-left layout
- **Date, number, and currency formatting**: locale-aware APIs

## Chapter Checklist

- Are all user-facing strings externalized?
- Do your layouts accommodate text expansion (30%+ variance)?
- Have you tested with RTL languages?

---
