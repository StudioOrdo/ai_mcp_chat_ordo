# ADR 001 — Capability Runtime Is The Canonical Runtime Projection

## Status

Accepted

## Context

The platform currently defines and assembles capabilities across several layers.

The catalog is the best existing source of truth, but the runtime shape of a
capability is reconstructed in multiple places, especially around:

- binding logic
- tool descriptor assembly
- bundle registration
- execution planning explanation

This increases drift and makes the platform harder for agents and developers to
reason about.

## Decision

Introduce `CapabilityRuntime` as the canonical runtime projection for a
capability.

The catalog remains the canonical metadata source of truth.

`CapabilityRuntime` becomes the canonical runtime-facing projection that is
consumed by:

- tool registration
- execution planning explanation
- user and agent capability presentation
- future platform facade work

## Consequences

### Positive

- one capability gains one inspectable runtime representation
- runtime assembly becomes more explainable
- tool registration requires fewer manual metadata touch points
- future platform work can depend on the runtime projection instead of local
  assembly seams

### Negative

- migration adds one new layer before old assembly paths can be deleted
- parity tests are required to keep projection honest
- some current files will temporarily look more layered during transition

## Rules

1. `CapabilityRuntime` must be projected, not manually authored.
2. The catalog remains the canonical metadata owner.
3. Old runtime assembly paths may remain temporarily, but only while parity is
   being proven.
4. Deletion of legacy assembly logic requires projection parity tests.
5. Phase 1 must not expand into unrelated search, timeline, or revision work.

## Alternatives Considered

### Alternative 1: Keep Current Layering And Only Clean Up Locally

Rejected because it preserves duplicate ownership and does not improve the
platform model.

### Alternative 2: Make ToolRegistry The Canonical Runtime Owner

Rejected because registry should execute and look up tools, not synthesize
metadata.

### Alternative 3: Rewrite Capability System Around A New Monolithic Platform

Rejected because it is too wide for the first migration slice and would delay
useful simplification.

## Follow-Up

This ADR is implemented by Phase 1 of the roadmap and should be read together
with:

- `phase-1-capability-runtime-implementation.md`
- `module-map.md`
- `contracts-and-interfaces.md`
- `validation-and-test-strategy.md`
