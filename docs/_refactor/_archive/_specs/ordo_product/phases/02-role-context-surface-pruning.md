# Phase 02 - Role Context Surface Pruning

## Objective
Define product-shaped tool contexts for anonymous, authenticated, apprentice,
staff, and admin users without deleting useful existing capabilities.

## Contexts
- `customer_default`
- `customer_media`
- `customer_affiliate`
- `customer_support`
- `customer_accessibility`
- `staff_support`
- `staff_affiliate_ops`
- `admin_operations`
- `admin_prompt_governance`
- `admin_factory_content`
- `founder_coach`

## Current Code Grounding
- Roles are already present in catalog core facets.
- Instance tool config can enable/disable tools globally.
- Tool bundles exist by domain, but not yet by product context.

## Implementation Steps
1. Add context projection over catalog capabilities.
2. Keep bundle ownership technical; add product context ownership separately.
3. Update prompt builder/tool schema selection to accept context hints.
4. Add classifier or deterministic routing inputs later; start with explicit
   route/session context.
5. Add guardrails for role/context matrix.

## Tests
- Authenticated customer default excludes admin diagnostics.
- Authenticated customer affiliate context includes own affiliate tools.
- Staff affiliate ops context includes affiliate summaries/exceptions but not
  runtime logs.
- Admin operations context includes logs and admin search.
- Accessibility context includes theme/UI adjustment tools for all roles.

## Done Criteria
- Context policy is tested and documented.
- Prompt tool count varies by context.
- No capability deletion is required in this phase.

