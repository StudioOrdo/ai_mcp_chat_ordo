# Tool Operation Architecture Audit

Status: Drafted from current code and live eval evidence on 2026-05-03

## Purpose

This package audits Ordo's current tool/function surface after the provider,
appliance, backup/restore, and AgentOS operation-kernel work. The goal is to
standardize the next version of tools around composable capabilities and durable
operations instead of a large set of product-specific prompt commands.

The greenfield stance is intentional: if a tool exists only because an earlier
system needed a shortcut, it should be collapsed, demoted, or removed once the
operation-backed replacement exists.

## Current Grounding

Important code anchors:

- Capability definitions: `src/core/capability-catalog/capability-definition.ts`
- Capability families: `src/core/capability-catalog/families/*`
- Runtime binding/projection: `src/core/capability-catalog/runtime-tool-binding.ts`,
  `src/core/capability-catalog/runtime-tool-projection.ts`
- Tool registry: `src/core/tool-registry/ToolRegistry.ts`,
  `src/core/tool-registry/ToolDescriptor.ts`
- Bundle registration: `src/lib/chat/tool-bundle-composition.ts`,
  `src/lib/chat/tool-bundles/*`
- Operation kernel: `src/core/entities/operation.ts`,
  `src/core/use-cases/operations/*`, `src/lib/operations/*`
- Media operation migration: `src/lib/media/workflows/media-workflow-operation-*`
- Factory operation migration: `src/lib/factory/factory-work-order-operation-*`
- Backup/restore Rust boundary: `src/lib/appliance/native/*`,
  `crates/ordo-backup/src/native_contract.rs`
- Live eval harness: `src/lib/evals/tool-coverage.ts`,
  `src/lib/evals/tool-workflow-coverage.ts`,
  `src/lib/evals/eval-artifacts.ts`

## Audit Conclusion

The system has the right foundation now: catalog-owned schemas, execution target
ownership, runtime tool gating, an operation ledger, action buttons, and Rust as
a narrow native executor. The next reliability gain is not "more tools." It is
making tools smaller, typed, composable, and operation-backed.

The main architectural problem is shape drift:

- Some tools are real primitives: search, inspect, list, calculate, update
  profile, set theme, list media assets.
- Some tools are product recipes: `produce_blog_article`, `produce_product`,
  `compose_media`.
- Some tools are internal steps that should usually not be prompt-facing:
  `compose_blog_article`, `qa_blog_article`, `resolve_blog_article_qa`,
  `generate_blog_image_prompt`, `draft_content`.
- Some tools advertise as inline even though the user-facing behavior is
  operation or browser/native backed, especially media.

The target is a smaller prompt surface backed by a larger deterministic
capability graph.

## Target Rule

Do not make a new prompt-visible tool because a feature exists. Define the
primitive capability, expose it through the operation kernel, and create product
recipes as operation templates.

Example:

- Avoid: "blog tool" as a standalone product command with its own lifecycle.
- Prefer: content draft, QA, image generation, publish, artifact selection, and
  review actions composed into a `content_publish` operation template.

## Package Contents

- `evidence/current-tool-inventory.md`: current registry and code inventory.
- `evidence/tool-classification.md`: current tool-by-tool target class and
  pruning direction.
- `target-architecture.md`: ideal composable tool architecture and Rust split.
- `phase-plan.md`: implementation phases to get from current state to target.
