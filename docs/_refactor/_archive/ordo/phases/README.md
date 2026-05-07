# Ordo Product Shape Phases

Status: Planned

These phases implement the product shape from `../README.md` and the specs in
`../specs/`.

The sequence is intentionally product-first:

1. prove the public site shape,
2. create public feed/offers contracts and remove public library/journal
   assumptions,
3. add research and review kernels,
4. run the text/audio flagship workflow,
5. extend with assets/media,
6. make workflows reusable,
7. prepare agent-readable views,
8. prune old surfaces after tests pass.

## Phase List

1. `00-baseline-evidence.md`
2. `01-public-site-shell-and-navigation.md`
   - `01a-public-shell-chat-and-ui-audit.md`
   - `01b-route-access-and-public-surface-contract.md`
   - `01c-public-navigation-footer-and-mobile-system.md`
     - `01c0-navigation-refactor-grounding-and-contract.md`
     - `01c1-public-discovery-and-conditional-feed.md`
     - `01c2-public-mobile-footer-and-safe-area-system.md`
     - `01c3-authenticated-workspace-tool-rail.md`
       - `01c3a-activity-source-map-and-notification-taxonomy.md`
       - `01c3b-activity-read-model-and-receipts.md`
       - `01c3c-mobile-first-user-dashboard.md`
       - `01c3d-activity-page-and-attention-inbox.md`
       - `01c3e-single-column-work-index-and-jobs-convergence.md`
       - `01c3f-top-rail-brand-balance-and-mobile-work-controls.md`
       - `01c3g-activity-dashboard-regression-closeout.md`
       - `01c3h-object-centered-information-architecture.md`
       - `01c3i-ordo-card-system-and-progressive-disclosure.md`
       - `01c3j-object-detail-lenses-provenance-funnel-and-performance.md`
       - `01c3k-studio-business-surface-consolidation.md`
       - `01c3l-hitl-dashboard-and-ceo-command-loop.md`
       - `01c3m-object-centered-ux-regression-closeout.md`
       - `01c3n-authenticated-route-and-left-rail-consolidation.md`
       - `01c3o-conversational-and-ui-offer-creation.md`
       - `01c3p-people-customer-stage-and-funnel-cards.md`
       - `01c3q-tracked-links-qr-and-attribution.md`
       - `01c3r-content-campaign-performance-loop.md`
       - `01c3s-solopreneur-results-dashboard-and-next-actions.md`
       - `01c3t-solopreneur-operating-loop-closeout.md`
       - `01c3u-shell-menu-and-account-surface-alignment.md`
       - `01c3v-people-selection-column-and-mobile-drill-in.md`
       - `01c3w-person-detail-header-facts-and-source-actions.md`
       - `01c3x-relationship-brief-current-summary.md`
       - `01c3y-relationship-trail-and-source-linking.md`
       - `01c3z-relationship-settings-and-people-shell-closeout.md`
       - `01c3aa-menu-aesthetic-and-focus-polish.md`
       - `01c3ab-media-workspace-object-detail-and-selector-polish.md`
       - `01c3ac-canonical-ux-governance-baseline.md`
       - `01c3ad-chat-first-shell-grid-and-mobile-menu.md`
       - `01c3ae-shared-governance-section-framework.md`
       - `01c3af-account-user-info-referrals-preferences.md`
       - `01c3ag-today-brief-and-decision-evidence-index.md`
       - `01c3ah-studio-production-media-work-consolidation.md`
       - `01c3ai-offers-brief-selector-and-detail-governance.md`
       - `01c3aj-about-business-story-governance.md`
       - `01c3ak-system-admin-jobs-backups-restore-sections.md`
       - `01c3al-cross-section-object-detail-provenance-actions.md`
       - `01c3am-brief-read-model-storage-and-evidence-manifests.md`
       - `01c3an-brief-executor-command-result-reconcile.md`
       - `01c3ao-canonical-ux-regression-closeout.md`
       - `01c3ap-account-menu-password-and-affiliate-route-alignment.md`
     - `01c4-admin-global-factory-navigation-rail.md`
     - `01c5-command-seo-and-route-state-parity.md`
     - `01c6-navigation-regression-cleanup-and-closeout.md`
   - `01d-conversational-homepage-composition.md`
   - `01e-public-motion-scrollytelling-and-responsive-polish.md`
   - `01f-public-shell-regression-cleanup-and-closeout.md`
3. `02-public-feed-contract-and-replacement.md`
4. `03-business-profile-offers-and-public-profile.md`
5. `04-research-bundle-and-librarian-adapter.md`
6. `05-campaign-pillars-and-kpi-loop.md`
7. `06-review-kernel-and-qa-depth.md`
8. `07-content-campaign-workflow-text-audio.md`
9. `08-internal-asset-catalog-and-media-short-extension.md`
10. `09-workflow-template-versioning-and-run-inspector.md`
11. `10-agent-ready-business-views.md`
12. `11-rust-runtime-boundary-and-local-ai.md`
13. `12-pruning-evals-and-closeout.md`

## Phase Discipline

Before implementation of any phase:

- refresh code grounding,
- update that phase doc with exact files and current test names,
- QA the doc,
- implement,
- run required tests,
- update the phase closeout.
