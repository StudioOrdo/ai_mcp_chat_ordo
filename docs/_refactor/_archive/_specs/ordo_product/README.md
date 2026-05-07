# Ordo Product Architecture

## Product Thesis
Ordo is a personal operating system for solopreneurs.

The user is the CEO. Ordo is the executive assistant, chief of staff, operator,
and coach that routes work through specialized business units. The product
should feel like a virtual office/corporation, not like a flat chatbot with 59
visible implementation tools.

## Current Grounding
This spec is grounded in the current system:
- `CAPABILITY_CATALOG` and `CapabilityRuntime` are the control plane.
- Current catalog has 59 capabilities.
- Jobs, asset catalog, workspace restore, execution timelines, relationship
  memory, prompt governance, referrals, media, and factory work orders already
  exist as real infrastructure.
- The main gap is product shape: default tool exposure and user workflows are
  still too implementation-level.

## Product North Star
Ordo should let a solopreneur:
- access paid knowledge and personalized guidance;
- create custom media and artifacts from their conversations;
- track jobs, assets, work, referrals, and next actions;
- receive useful briefings, not noisy notifications;
- manage accessibility/theme/profile preferences;
- operate a small business pipeline with leads, referrals, deals, training, and
  content production;
- get coaching that improves execution, not just answers questions.

## Hard Constraints
1. Do not add a pile of new tools as the first move.
2. Keep current real capabilities, but classify and contextualize exposure.
3. Separate execution permission from prompt visibility.
4. Keep theme/accessibility available to all users.
5. Authenticated users are paying customers, students, or site members.
6. Staff and admin surfaces must differ; staff should not get logs/system
   control by default.
7. Bug reports/support are allowed for users, but logs are staff/admin only.
8. Affiliate QR and affiliate performance are first-class product workflows.
9. Notifications must become an attention/inbox model, not just push events.
10. Business units can depend on shared services, but should not create
    ungoverned agent-to-agent sprawl.

## Package Contents
- `product-model.md`: product framing, business units, and role model.
- `target-architecture.md`: control plane, business-unit services, prompt
  exposure, events, and inbox architecture.
- `capability-map.md`: current capabilities mapped to product offices.
- `roadmap.md`: implementation sequence.
- `phases/`: implementation-ready phases.

## Relationship To Existing Specs
This spec does not replace the solopreneur hardening phases. It sets the
product architecture those phases should serve.

Important dependencies:
- `docs/_specs/solopreneur-core-hardening/phases/01-server-asset-catalog-completion.md`
- `docs/_specs/solopreneur-core-hardening/phases/02-search-index-execution.md`
- `docs/_specs/solopreneur-core-hardening/phases/03-unified-mcp-registry-cutover.md`
- `docs/_specs/solopreneur-core-hardening/phases/04-storage-accounting-projection.md`
- `docs/_specs/solopreneur-core-hardening/phases/05-work-order-summary-read-model.md`
- `docs/_review/agent-tool-surface-hot-path-review/`

