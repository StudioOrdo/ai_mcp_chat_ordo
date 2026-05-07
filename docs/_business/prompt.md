# Ordo Phase Execution Prompt

Use this prompt by replacing `[PHASE_FILE_PATH]` with the phase you want
implemented.

```text
Implement [PHASE_FILE_PATH]

Heads down.

Follow the phase spec exactly. Treat these as governing contracts:
- docs/_business/ux/08-product-kernel-contract.md
- docs/_business/ux/09-canonical-ux-architecture.md
- docs/_business/ux/00-ux-north-star.md
- docs/_business/ordo_process.md

Core invariant:
Chat is the operating interface. UI surfaces are the governance layer.

Before editing:
1. Read the phase spec.
2. Read the governing UX/product docs above.
3. Research every current-code anchor named in the phase.
4. Verify which phase claims are already implemented, missing, stale, or wrong.
5. Identify the kernel object(s), read model(s), donor route/component(s),
   visibility rule(s), and progressive-disclosure level(s) affected.
6. Do not invent new architecture if existing code can be reused, reframed, or
   extracted into shared components.

Implement the phase end to end:
- update code,
- add or update positive, negative, and edge tests from the phase,
- preserve role/access/privacy boundaries,
- preserve provenance/evidence/trail paths,
- preserve chat-first behavior,
- keep raw jobs/logs/provider details out of regular owner UI,
- update the phase doc and evidence docs with what actually changed.

Architecture rules:
- Components render product read models; they do not derive business meaning
  directly from raw tables or job/log internals.
- Base section routes render a section brief.
- Query-selected/detail routes render one selected object detail.
- The second column is an evidence/object selector, not a dashboard.
- Selected object details do not start with global section totals.
- Admin/System may expose diagnostics, but only behind role gates.
- Brief/background intelligence work must follow durable request/result/
  reconcile semantics, modeled on backup/restore, when the phase touches brief
  generation or background summaries.

QA pass 1:
- run the exact tests required by the phase,
- run focused related tests for touched areas,
- run typecheck/lint where relevant,
- inspect for UX/product drift against the governing contracts,
- inspect mobile/list-detail behavior where the phase touches shell or
  governance surfaces,
- fix every issue found.

QA pass 2:
- rerun the phase tests and focused related tests after fixes,
- rerun typecheck/lint if code changed during QA pass 1,
- run stale-surface/static scans named in the phase,
- verify no fake metrics, ungrounded claims, private leaks, raw job/log/provider
  details, or diagnostic nouns appear in regular owner/public UI,
- verify phase docs/evidence docs match the final implementation,
- fix every issue found.

Do not stop until both QA passes are complete, all required tests pass, and the
final answer lists:
- files changed,
- tests run,
- issues found and fixed in QA pass 1,
- issues found and fixed in QA pass 2,
- remaining explicit risks or deferred work.
```

## Short Variant

Use this only for small documentation-only phases:

```text
Implement [PHASE_FILE_PATH] using docs/_business/ux/08-product-kernel-contract.md
and docs/_business/ux/09-canonical-ux-architecture.md as governing contracts.
Research the named code/docs first, update the phase and affected docs, then QA
twice with the phase-required checks and static scans. Final answer must list
files changed, checks run, QA pass 1 fixes, QA pass 2 fixes, and remaining
risks.
```
