# Phase 06 - Work Orders, Content, And Library Workflows

## Objective
Use work-order/read-model architecture to simplify Content Studio and Product
Factory, and prepare for research/write/QA/store-in-library workflows.

## Current Code Grounding
- `produce_product`
- Work orders and `ProductionOrchestrator`
- Stage executor registry and QA checks
- Blog/journal tool surface
- Phase 05 work-order summary read model
- Corpus/search/library infrastructure

## Product Direction
- Keep internal production operations modular.
- Stop exposing every journal/blog mutation as a default agent tool.
- Use read models and product workflow context to present state.
- Treat research/write/QA/store-in-library as a future Product Factory /
  Knowledge Office workflow.

## Implementation Steps
1. Implement or consume work-order summary read model.
2. Classify blog/journal step tools as admin/factory/content context rather than
   default prompt.
3. Identify which old blog tools can become internal-only after UI/work-order
   flow is complete.
4. Define research packet, QA report, and library entry contracts for future
   library workflow.
5. Add tests for prompt hiding without deleting execution paths.

## Tests
- Blog/journal internals are hidden from normal customer prompt.
- Admin/factory context still has necessary content operations.
- Work-order list surfaces use summaries.
- Full work-order hydration remains only for detail/mutation paths.

## Done Criteria
- Content/product production feels workflow-shaped.
- Default prompt no longer exposes every internal content mutation.

