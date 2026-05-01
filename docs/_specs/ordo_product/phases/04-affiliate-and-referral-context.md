# Phase 04 - Affiliate And Referral Context

## Objective
Make affiliate/referral workflows clear for authenticated users, staff, and
admin without adding new tools first.

## Expected Workflows
Authenticated/affiliate:
- "Show my QR code."
- "How many referrals do I have?"
- "Did anyone use my link?"
- "What credits or conversions have I earned?"

Staff/admin:
- "Which affiliates are performing?"
- "Which referrals need review?"
- "Export or inspect affiliate performance."

## Current Code Grounding
- `get_my_referral_qr`
- `get_my_affiliate_summary`
- `list_my_referral_activity`
- `get_admin_affiliate_summary`
- `list_admin_referral_exceptions`
- Referral ledger, analytics, QR routes, admin affiliate pages.

## Implementation Steps
1. Classify affiliate tools by user vs staff/admin context.
2. Ensure QR capability enablement is represented in profile/admin UI.
3. Make tool descriptions user-outcome oriented.
4. Verify staff/admin cannot leak private affiliate details outside policy.
5. Add notification/inbox event candidates for referral milestones.

## Tests
- User sees only own affiliate data.
- Staff/admin affiliate context sees operational summaries as policy allows.
- Non-enabled affiliate states degrade clearly.
- Affiliate QR is accessible when enabled.

## Done Criteria
- Affiliate workflows are first-class and role-scoped.
- No new tool names are required.

