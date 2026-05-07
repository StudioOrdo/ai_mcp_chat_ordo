# Spec 11: Admin Migration, Cleanup, And Tool Pruning

## Goal

Keep the codebase clean by migrating old feature-specific surfaces to the new
product model and deleting dead code only after replacement paths pass.

## Current Code To Use

- `src/core/capability-catalog/capability-ownership.ts` classifies core and
  extension pack tools.
- `src/lib/chat/tool-composition-root.ts` composes the registry and applies
  runtime availability.
- `src/core/capability-catalog/families/blog-capabilities.ts` contains current
  blog/journal prompt-visible surfaces.
- `src/core/capability-catalog/families/media-capabilities.ts` contains current
  media surfaces.
- `docs/_refactor/tool-operation-architecture-audit/README.md` records the
  existing tool audit.
- `tests/full-registry-coverage.test.ts`, `tests/core-policy.test.ts`, and
  `tests/tool-plugin-registry.test.tsx` cover registry shape.

## Required Work

- Add a deprecation matrix for old tools/routes.
- Make old tools temporary wrappers only where current code still needs a
  tested bridge. Do not preserve public routes for legacy users; this is
  greenfield.
- Remove prompt exposure before removing execution internals.
- Keep admin migration pages and docs accurate during transition.

## Cleanup After Replacement

Candidates:

- `compose_blog_article`
- `qa_blog_article`
- `resolve_blog_article_qa`
- `generate_blog_image_prompt`
- `draft_content` as public/product wording
- `/journal` and `/blog` as public names
- public `/library` route and navigation behavior

## Positive Tests

- New workflow passes before old prompt surface is hidden.
- Hidden tool no longer appears in prompt manifest or role directives.
- Deleted public route returns the intentional replacement behavior
  (`notFound`, auth-gated internal route, or feed-backed route), with no silent
  legacy fallback.

## Negative Tests

- Removing a tool cannot break historical artifact rendering.
- Admin protected recovery tools cannot be disabled by normal pruning.
- Role directives cannot mention disabled/deprecated tools.

## Edge Tests

- Worktree has old operation/job records created by old tools.
- Stale public URLs fail or route only through documented greenfield
  replacements.
- Extension pack disabled hides prompt surface but preserves old assets.
