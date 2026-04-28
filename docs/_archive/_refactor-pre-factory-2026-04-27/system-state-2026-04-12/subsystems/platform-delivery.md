# Platform And Delivery Subsystem Plan

Date: 2026-04-12

## Scope

This document covers the platform and delivery subsystems:

- auth and session handling
- database and repository assembly
- route handlers and validation
- app shell and layout
- admin delivery surface
- frontend component boundaries

## Current State Matrix

| Subsystem | Current role | Health | Preserve | Refactor target | Evidence |
| --- | --- | --- | --- | --- | --- |
| Auth and session | cookie-backed auth, session validation, role overlay | acceptable | interactor-based auth flow | clarify production versus simulation paths, reduce assembly duplication | [../../../../src/lib/auth.ts](../../../../src/lib/auth.ts#L115) |
| Database handle | process-global SQLite access with WAL and busy timeout | acceptable for current topology | better-sqlite3 and simple deployment model | make scaling assumptions explicit | [../../../../src/lib/db/index.ts](../../../../src/lib/db/index.ts#L32) |
| Repository assembly | process-cached factory for many repos | mixed | repository interfaces and mapper pattern | define where service-locator access is allowed | [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L45) |
| App shell | pathname-driven surface selection and layout branching | workable but rigid | route-surface concept and theme bootstrap | reduce pathname branching and centralize shell policy | [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L15), [../../../../src/app/layout.tsx](../../../../src/app/layout.tsx#L73) |
| Admin delivery | role-gated dashboard with partial loader failure tolerance | good but scattered | all-settled loading and component library | colocate loaders, actions, and client tables by feature | [../../../../src/app/admin/page.tsx](../../../../src/app/admin/page.tsx#L48) |
| Route handlers | thin wrappers in many places, inconsistent validation across the surface | mixed | route template pattern | standardize request validation and response contracts | [../../../../src/app/api/chat/route.ts](../../../../src/app/api/chat/route.ts#L13), [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L26) |

## Preserve

| Keep | Why |
| --- | --- |
| Auth interactors and session-validation flow | The auth logic is simple and understandable |
| better-sqlite3 for current stage | It fits the current deployment posture and keeps operations simple |
| Data mapper and repository interfaces | They provide useful seams even if assembly rules need cleanup |
| Root layout theme bootstrap | It solves a real UX issue correctly |
| Admin dashboard tolerance for partial loader failure | It keeps the surface usable under degraded conditions |

## Replace Or Reshape

| Replace or reshape | Why |
| --- | --- |
| Mixed factory and direct-construction dependency access | It increases hidden coupling and testing cost |
| Pathname-driven shell branching | It works, but it spreads route-surface policy into component logic |
| Scattered admin feature ownership across `app`, `components`, `lib/admin`, and `lib/operator` | It makes changes harder to land and review |
| Inconsistent request validation | Route safety and client contracts are too uneven |

## Work Packages

### 1. Dependency Assembly Rules

| Package | Files | Outcome |
| --- | --- | --- |
| define allowed service-locator zones | [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L45), [../../../../src/lib/chat/conversation-root.ts](../../../../src/lib/chat/conversation-root.ts#L92) | fewer hidden dependencies |
| remove ad hoc mapper construction from layout-level code where practical | [../../../../src/app/layout.tsx](../../../../src/app/layout.tsx#L97) | cleaner top-level composition |

### 2. Route Contract Standardization

| Package | Files | Outcome |
| --- | --- | --- |
| define a shared validation pattern for request bodies | [../../../../src/app/api/chat/route.ts](../../../../src/app/api/chat/route.ts#L13), [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L26), `src/app/api/**/route.ts` | request parsing becomes predictable |
| define a typed response-contract convention for route handlers | `src/lib/chat/http-facade.ts`, `src/app/api/**/route.ts` | API drift reduces |

### 3. Shell Simplification

| Package | Files | Outcome |
| --- | --- | --- |
| extract route-surface policy from the component body | [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L15) | shell behavior becomes declarative |
| clarify which shell behaviors belong in layout versus child shell | [../../../../src/app/layout.tsx](../../../../src/app/layout.tsx#L73), [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L15) | less duplicated route logic |

### 4. Admin Feature Colocation

| Package | Files | Outcome |
| --- | --- | --- |
| group admin loaders, actions, and tables by feature instead of by layer | [../../../../src/app/admin/page.tsx](../../../../src/app/admin/page.tsx#L48), `src/lib/admin/*`, `src/lib/operator/*`, `src/components/admin/*` | easier feature ownership |
| move feature-specific table clients closer to their data loaders | `src/components/admin/*TableClient.tsx`, `src/app/admin/**` | less cross-folder churn |

## Immediate Next Moves

1. Define and document dependency-assembly rules around [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L45).
2. Standardize route validation patterns before adding more API surface.
3. Extract route-surface policy out of [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L15).
4. Pick one admin feature area and use it as the colocation pilot for loaders, actions, and client tables.

## Desired End State

The platform side should keep its current simplicity but make its rules explicit: one clear dependency-assembly model, one clear route-validation pattern, one clear shell-policy layer, and admin features that are organized by ownership rather than by implementation layer.
