# Phase Index

This directory breaks provider capability configuration into small, reviewable
phases. Each phase should be completed and validated before the next phase
depends on it.

## Sequence

0. [Phase 00 - Baseline Evidence](00-baseline-evidence.md)
1. [Phase 01 - Runtime Tool Control Plane](01-runtime-tool-control-plane.md)
2. [Phase 02 - Provider Contract And Surface Inventory](02-provider-contract-and-surface-inventory.md)
3. [Phase 03 - Provider Config Resolver And Catalog](03-provider-config-resolver-and-catalog.md)
4. [Phase 04 - Shared Validation And Client Factories](04-shared-validation-and-client-factories.md)
5. [Phase 05 - Install And Admin Provider UI](05-install-and-admin-provider-ui.md)
6. [Phase 06 - Runtime Integration And Env Helper Pruning](06-runtime-integration-and-env-helper-pruning.md)
7. [Phase 07 - Provider Capability Availability And Tool Pruning](07-provider-capability-availability-and-tool-pruning.md)
8. [Phase 08 - Health Diagnostics Docs And Closeout](08-health-diagnostics-docs-and-closeout.md)

## Phase Rules

- Do not skip baseline evidence.
- Do not introduce another configuration store.
- Do not build provider-specific tool pruning before the general runtime tool
  control plane exists.
- Do not read provider truth directly from raw env in new runtime code.
- Do not offer disabled/missing-provider tools to the model.
- Do not let prompt hints describe tools that are disabled in the effective
  runtime manifest.
- Do not let normal admin controls disable protected recovery tools.
- Do not remove direct route/job guards just because registry pruning exists.
- Keep OpenAI optional and capability-scoped.
- Keep generated assets reusable when generation providers are disabled.
