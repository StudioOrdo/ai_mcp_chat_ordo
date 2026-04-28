# Journal Pipeline DAG Gap Analysis

## Purpose

This document evaluates whether the current journal/article production flow should remain a composite job or evolve into a DAG-style job graph.

## Current State

The repo already exposes separate editorial tools and also a composite production flow.

Current editorial tool surfaces include:

- `compose_blog_article`
- `qa_blog_article`
- `resolve_blog_article_qa`
- `generate_blog_image_prompt`
- `generate_blog_image`
- `produce_blog_article`
- `publish_content`

Relevant files:

- [src/core/use-cases/tools/blog-production.tool.ts](/Users/kwilliams/Projects/ordoSite/src/core/use-cases/tools/blog-production.tool.ts)
- [src/lib/blog/blog-article-production-service.ts](/Users/kwilliams/Projects/ordoSite/src/lib/blog/blog-article-production-service.ts)
- [src/lib/jobs/job-capability-registry.ts](/Users/kwilliams/Projects/ordoSite/src/lib/jobs/job-capability-registry.ts)

`produce_blog_article` already behaves like a phased orchestrator. It emits progress through named phases, but it is still one deferred job capability, not a graph of dependent jobs.

## What The Current Job System Supports

The current job model supports:

- queued/running/succeeded/failed/canceled/dead_letter lifecycle
- retry scheduling and retry exhaustion
- progress labels and phase-compatible state
- lineage-ish fields like `replayedFromJobId` and `supersededByJobId`

It does not currently support a true DAG scheduler with:

- explicit dependency edges
- fan-out/fan-in semantics
- sub-job readiness resolution
- graph-level partial rerun policies
- graph-level success/failure rollups

Relevant model:

- [src/core/entities/job.ts](/Users/kwilliams/Projects/ordoSite/src/core/entities/job.ts)

## Recommendation

Do not move directly to a full DAG scheduler as the next step.

That would be a major orchestration change, and the current system already has solid primitives for:

- deferred execution
- phase progress
- retry and failure semantics
- transcript and jobs-page projection

The better path is staged evolution.

## Suggested Staged Path

### Stage 1: Make sub-steps explicit in evidence and recovery

Keep `produce_blog_article` as the top-level deferred capability, but standardize:

- canonical phase events
- per-phase timings
- per-phase retry recommendations
- per-phase artifact lineage

This yields better eval coverage without changing orchestration architecture.

### Stage 2: Allow decomposed execution as an internal mode

Introduce an optional orchestrator mode where the phases can run as separate logical tasks while still presenting as one top-level production job.

Goal:

- gain sub-step retry and observability
- avoid exposing DAG complexity to end users too early

### Stage 3: Introduce true DAG semantics only if proven necessary

Only add graph scheduling when there is a concrete need for:

- parallel steps
- conditional branches
- partial rerun of downstream edges
- reusable intermediate artifacts across independent pipelines

## Why This Matters For Media Evals

The same lesson applies to media workflows.

Before building a DAG scheduler for media or journal work, the system should first have:

1. a canonical media eval matrix
2. strong recovery and continuity tests
3. explicit per-step truth contracts
4. consistent artifact lineage and replay semantics

If those are missing, adding DAGs increases complexity without solving the right problem.

## Potential New Tool Surfaces

If we do expand the system, these are the most useful additions:

1. `media_plan_validate`
   - validate compose plans, route eligibility, and governed asset readiness before execution

2. `media_artifact_verify`
   - inspect final artifact streams, duration, silence, and playback readiness

3. `media_recover_job`
   - operator-facing recovery tool that selects retry, reroute, or resume based on failure class

4. `journal_pipeline_inspect`
   - return current stage, pending dependencies, and retry guidance for article production flows

5. `journal_pipeline_retry_stage`
   - rerun one failed stage without re-executing the whole article-production flow when safe

## Conclusion

The current system is not a DAG scheduler today.

It is a deferred-job system with strong phase semantics and room to evolve. The near-term priority should be:

1. formal media eval requirements
2. matrix-driven coverage
3. recovery/continuity parity for media jobs
4. explicit stage evidence for journal production

That sequence raises confidence without forcing a premature graph runtime redesign.