# Decision Record

Status: Initial product decisions
Date: 2026-05-04

This file captures the product decisions that shaped the Ordo refactor package.
Future implementers should treat these as the starting hypothesis, not as
unchangeable law. Change them only after grounding in code and updating specs.

## Decisions

1. The homepage is a conversation-first hero.

The default assistant message is the public entry point. Static marketing copy
should support the conversation, not replace it.

2. The public site stays small.

The default public surface is `/`, `/feed`, `/offers`, and `/about`. `/library`
is internal by default and can become public only through configuration.

3. The feed is the public publishing spine.

Articles, audio episodes, shorts, updates, and case studies should appear as
feed items with content negotiation for human pages, RSS/audio consumers, and
future agent-readable views.

4. QR/referral stays core.

The QR affiliate/referral loop is not a side feature. It gives solopreneurs an
immediate business outcome: hand someone a code, see whether they returned,
created an account, and met the objective.

5. Media stays core, but tools should consolidate.

Audio, charts, graphs, image generation, and short video assembly prove complex
composition. The target is fewer prompt-visible tools backed by reusable
operations and workflow steps.

6. Workflows are first-class artifacts.

When a user manually performs a useful process, Ordo should be able to turn that
conversation into an editable, versioned, runnable workflow. Runs must be
inspectable after completion.

7. QA is product behavior.

Content should have a governed review loop with configurable depth:

- `none` - fastest, no automated review.
- `standard` - one review/revise loop.
- `intermediate` - two loops or one stricter multimodal loop when available.
- `aggressive` - more review and higher cost/latency for high-stakes output.

8. Rust is for deterministic runtime work, not product policy.

Rust should own bounded, high-reliability execution where it helps: backup,
restore, local search/indexing, media inspection, transcription, artifact
checks, and future local model runners. TypeScript should own user policy,
workflow orchestration, permissions, and UI.

9. Greenfield cleanup is allowed.

There are no legacy customers to protect. Keep data migrations only where they
protect development state or simplify verification. Delete dead feature surfaces
after replacements pass.

10. The founder workflow is the first proof.

The first flagship workflow is:

`Research -> Synthesis -> Article -> Review -> Script -> Review -> Audio Episode -> Feed Publish -> Metrics -> Save Workflow`

Then extend to:

`Image -> 30s Promo Short -> Feed/Shorts Publish`

