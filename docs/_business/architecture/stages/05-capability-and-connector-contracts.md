# Stage 05 - Capability And Connector Contracts

## Goal

Let workflows use unknown future tools without being rewritten.

## Build

- Make capability classes explicit.
- Define connector output contracts for research tools.
- Complete catalog-driven MCP export and RBAC enforcement.
- Define source policy: local corpus, web, public libraries, museums,
  marketplaces, Wikipedia, and future connectors.
- Normalize connector outputs into source refs, claims, evidence, timestamps,
  license notes, and provenance.

## Done

- Adding an eBay, Craigslist, museum, library, or Wikipedia connector means
  adding a capability implementation, not rewriting recipes.
- MCP, chat, jobs, and browser surfaces share capability identity and schema.

## Guardrails

- Do not hardcode connector names into recipe logic unless the recipe truly
  requires that exact source.
- Do not expose MCP tools without role enforcement.
