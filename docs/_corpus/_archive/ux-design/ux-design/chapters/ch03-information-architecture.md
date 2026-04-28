# Chapter 3 — Information Architecture: Organizing for Findability

## Abstract

Information architecture is the structural design of shared information environments. It determines whether users can *find* things and *understand* where they are. This chapter traces IA from Richard Saul Wurman's coinage through Peter Morville's faceted classification, card sorting methodologies, and the modern challenges of AI-augmented search and filter systems.

---

## Richard Saul Wurman and the Information Architect (1976)

**Richard Saul Wurman** coined the term "information architect" in 1976, before the web existed. His argument: the explosion of available information created an "information anxiety" — the gap between what people *understood* and what they *thought they should understand*.

Wurman proposed that information can be organized in exactly five ways (LATCH):

- **Location**: organized by place (maps, floor plans)
- **Alphabet**: organized A–Z (dictionaries, indexes)
- **Time**: organized chronologically (timelines, schedules)
- **Category**: organized by type (departments, genres)
- **Hierarchy**: organized by magnitude (best-to-worst, most-to-least)

Every information architecture uses some combination of LATCH. A recipe site uses category (cuisine type) + hierarchy (rating). A news site uses time (latest first) + category (section). Understanding which LATCH model serves the user's goal is the first IA decision.

---

## Peter Morville and the Information Architecture Honeycomb (2004)

**Peter Morville** co-authored *Information Architecture for the World Wide Web* and proposed the UX Honeycomb — seven qualities of valuable information systems:

1. **Useful**: serves a real need
2. **Usable**: can be operated effectively
3. **Desirable**: creates positive emotional response
4. **Findable**: content and features can be located
5. **Accessible**: available to people with disabilities
6. **Credible**: content is trustworthy
7. **Valuable**: delivers measurable business value

The IA-specific contribution is **findability**: can users locate what they need? This depends on navigation structure, search quality, labeling clarity, and the mental model alignment discussed in Chapter 2.

---

## Taxonomy, Navigation, and Search

Three mechanisms serve findability:

### Taxonomy (Classification)

How content is categorized. Flat taxonomies (tags) allow flexible grouping. Hierarchical taxonomies (categories → subcategories) provide structural navigation. Faceted taxonomies (multiple independent dimensions — color, size, price, brand) allow users to filter from any angle.

### Navigation (Browsing)

How users move through the structure. Global navigation exposes the top-level taxonomy. Local navigation shows the current section's structure. Breadcrumbs show the path from root to current position.

### Search (Direct Retrieval)

How users bypass the structure. Search serves users who know what they want but not where it lives. Effective search requires: autocomplete, typo tolerance, result ranking, and faceted filtering of results.

---

## What This Means for Us

Information architecture is the invisible skeleton of every product. Users don't see the IA — they feel its presence (when things are easy to find) or its absence (when they are lost).

## Chapter Checklist

- Can you describe your product's LATCH model (location, alphabet, time, category, hierarchy)?
- Can a new user find any piece of content within 3 interactions?
- Does your search support autocomplete, typo tolerance, and result filtering?
- Are your category labels based on user vocabulary (card sorting) rather than internal terminology?
- Is your navigation structured around user goals (what they want to do) rather than organizational structure (how you are organized)?
