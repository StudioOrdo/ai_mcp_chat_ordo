# Audience Value Audit - MCP + Next.js Teaching Focus

Date: 2026-03-02

## Objective

Increase practical value for readers by making the project’s core architecture and teaching intent explicit.

## What Was Working

- Strong chapters on orchestration method, process loops, 12-factor, and GoF.
- Strong evidence discipline with repository-grounded examples.
- Good progression from theory to implementation practice.

## Primary Gaps Identified

1. **No single canonical explanation of MCP for new readers**
   - MCP appears in multiple places but without a dedicated conceptual chapter.
2. **Under-explained rationale for Next.js + MCP as a combo**
   - The pairing is implied in implementation but not taught as architecture strategy.
3. **Capabilities roadmap not consolidated**
   - Potential extensions are discussed informally but not captured as a structured evolution path.
4. **Project value proposition not explicit enough on landing page**
   - README introduces the book, but does not fully answer "what this project actually does" for first-time visitors.

## Refactor Actions Implemented

1. Add dedicated chapter on MCP + Next.js architecture and roadmap.
2. Update README table of contents and framing to include this chapter.
3. Add explicit "what this project does" framing in case-study narrative.

## Audience Outcomes Targeted

- Faster onboarding for readers new to MCP.
- Clearer understanding of why architecture choices matter.
- Better transferability from this project to reader-owned systems.

## Next Editorial Opportunities

- Add architecture diagrams (request path, tool invocation path, validation loop).
- Add glossary chapter for MCP/orchestration vocabulary.
- Add chapter-end implementation labs with expected outputs.
