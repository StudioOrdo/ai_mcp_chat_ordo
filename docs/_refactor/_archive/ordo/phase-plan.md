# Phase Plan

Status: Planned
Date: 2026-05-04

This plan sequences the Ordo product shape work so implementation can move in
small, independently reviewable steps.

## Dependency Logic

The public shell comes first because it gives the product a clear destination.
The feed and offers come next because content and referrals need somewhere to
land. Research, review, and workflow runs then create the actual production
engine. Media, agent views, Rust boundaries, and pruning follow after the first
flagship loop is inspectable.

## Sequence

1. `00-baseline-evidence.md`
   - Refresh the inventory before edits.
   - Confirm current tests and donor systems.

2. `01-public-site-shell-and-navigation.md`
   - Establish `/`, `/feed`, `/offers`, and `/about`; remove public library,
     journal, and blog from the anonymous product surface.
   - Execute through `01a` through `01f` subphases so route truth, visible
     navigation, conversational homepage composition, motion, and cleanup stay
     independently reviewable.
   - The authenticated workspace track continues through
     `01c3ac` through `01c3ap` in
     `canonical-ux-governance/phase-plan.md` to complete the canonical
     chat-first shell, shared section layout, Today/Studio/Offers/Account/
     System convergence, and durable brief architecture.

3. `02-public-feed-contract-and-replacement.md`
   - Create the canonical feed contract and replace blog/journal public route
     assumptions instead of preserving them for legacy users.

4. `03-business-profile-offers-and-public-profile.md`
   - Ground public identity and offers in existing instance config.

5. `04-research-bundle-and-librarian-adapter.md`
   - Wrap corpus/search/conversation/web research into a reusable research
     bundle.

6. `05-campaign-pillars-and-kpi-loop.md`
   - Preserve QR/referral strength and connect content to measurable outcomes.

7. `06-review-kernel-and-qa-depth.md`
   - Make QA a generic product primitive rather than a blog-only helper.

8. `07-content-campaign-workflow-text-audio.md`
   - Implement the first text/audio flagship workflow.

9. `08-internal-asset-catalog-and-media-short-extension.md`
   - Extend the workflow with image/chart/graph/audio/short assets.

10. `09-workflow-template-versioning-and-run-inspector.md`
   - Save useful manual processes as editable, versioned workflows.

11. `10-agent-ready-business-views.md`
   - Expose safe business views for public agents and future agent-to-agent
     clients.

12. `11-rust-runtime-boundary-and-local-ai.md`
   - Add explicit Rust boundary proof for deterministic media/search/local AI
     helpers.

13. `12-pruning-evals-and-closeout.md`
   - Remove replaced surfaces after deterministic tests and inspectable eval
     artifacts pass.

## Stop Conditions

Stop a phase before implementation when:

- code grounding is stale;
- the phase cannot name exact files to modify;
- tests cannot be named before editing;
- cleanup would remove a feature without a tested replacement, except where the
  removed surface is greenfield-only public clutter with no target product role;
- the implementation would create another feature island instead of using
  operations, assets, feed items, or workflow runs.
