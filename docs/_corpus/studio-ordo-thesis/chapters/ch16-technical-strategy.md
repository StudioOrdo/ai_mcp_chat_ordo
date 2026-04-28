# 16. Technical Strategy

Studio Ordo is built around a simple architectural conviction:

> **Small-business AI infrastructure should be portable, inspectable, inexpensive, and powerful enough to operate without enterprise complexity.**

The system is designed as a self-contained workspace. It runs with a minimal stack, local persistence, embedded search, job orchestration, and a capability catalog that tells the AI what tools exist, how they work, where they can run, and how they should appear to the user.

The Model Context Protocol matters because tools become discoverable, callable capabilities.

A tool can be a search function, publishing action, media renderer, chart generator, CRM query, referral tracker, transcript processor, custom business workflow, or vertical-specific automation.

The capability catalog becomes the business surface.

Adding a vertical does not require rebuilding the product. It requires adding the right capabilities, workflows, prompts, policies, and execution targets.

Tools can run in multiple ways depending on context:

* inline in the host process
* as deferred jobs with retry, checkpointing, and cancellation
* as MCP sidecars
* as remote service calls
* in the browser via WebAssembly

That last point matters.

If media assembly, chart rendering, or transcript processing can happen on the user’s computer, Ordo can deliver richer production capability without carrying the full compute cost centrally.

The architecture is not just technical taste.

It is economic strategy.

Traditional multi-service stacks often carry higher operational complexity and fixed platform costs. Ordo’s self-contained architecture is designed to keep per-customer infrastructure unusually low.

MCP means capabilities can grow without turning the core into a monolith.

SQLite and self-contained persistence mean portability and trust.

Browser-side execution means the user’s own device becomes part of the production system.

Open source means inspection and adoption.

This is how Ordo can give small operators enterprise-style capability without enterprise overhead.

---
