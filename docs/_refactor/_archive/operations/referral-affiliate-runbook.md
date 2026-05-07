# Referral And Affiliate Operations Runbook

This runbook covers the recurring operator work for the shipped referral system.

It is intentionally narrower than feature-delivery docs. Use it when the runtime is already live and the question is how to review, reconcile, and release referral changes safely.

## Operating Surfaces

- `/admin/affiliates`
  - global affiliate performance, exception queue, credit review, and payout export
- `/referrals`
  - affiliate self-service share assets, recent activity, and truthful empty states
- release evidence and admin diagnostics
  - public-origin checks and anonymous referral-identity verification

## Review Cadence

### Daily or after active campaigns

1. Open `/admin/affiliates?view=exceptions`.
2. Review new exception items by kind:
   - missing referral join
   - disabled referral code
   - invalid referral source
   - credit review backlog
3. Resolve issues immediately when the fix is clear.
4. File follow-on work when the queue item reveals a product or data-integrity gap that cannot be closed safely from the current admin surface.

### Weekly or before payout review

1. Review `/admin/affiliates?view=leaderboard` and `/admin/affiliates?view=pipeline` equivalents from the main admin workspace.
2. Review credit-review backlog and update credit state only with a clear reason.
3. Export the payout-ready CSV from `/api/admin/affiliates/export` and inspect it as a review artifact, not as an automated payment instruction.
4. Confirm every approved or paid row has the expected `credit_state_changed` history.

### Before a release or referral-surface change

1. Run `npm run admin:health`.
2. Run `npm run release:evidence` when the release workflow needs fresh evidence.
3. Run `npm run qa:sprint-4` for the full focused referral governance bundle.
4. Perform the browser smoke matrix listed below.

## Browser Smoke Matrix

1. Open a canonical `/r/{code}` referral landing and verify invalid or disabled codes still render the branded referral-unavailable state.
2. Verify an anonymous referred session can ask `who referred me?` and receive the validated referrer identity.
3. Verify a non-referred session gets the truthful no-referrer response.
4. Verify `/referrals` still exposes share assets, recent activity, and truthful empty states.
5. Verify `/admin/affiliates` still shows the exception queue, review controls, and payout export path without duplicated workspace navigation regressions.

## Close Criteria

Close an exception item only when the underlying contract is actually restored.

### Missing referral join

Close only when the canonical referral row exists and the affected conversation is linked by `referral_id`.

### Disabled referral code or invalid referral source

Close only when the conversation no longer implies trusted attribution and the user-facing path still renders a truthful unavailable state.

### Credit review backlog

Close only when the credit-state decision is recorded with a reason and the referral row plus event history agree.

### Release-readiness failures

Close only when release evidence and diagnostics stop reporting referral-origin or anonymous referral-identity verification failures.

## Escalation Rules

Escalate to follow-on work instead of forcing an admin-only cleanup when:

1. the ledger and compatibility readers disagree in a way that suggests a runtime bug
2. the analytics dataset registry, graph source exposure, and tool manifest no longer agree on the same contract
3. release evidence reports a blocking referral-origin or anonymous identity failure
4. a fix would require widening access beyond the current `ADMIN` and affiliate-enabled model

## Deferred Boundary

The following remain intentionally out of scope for the shipped referral system:

1. automated payout execution
2. third-party affiliate-network integrations or outbound email automation
3. default `STAFF` access to global affiliate analytics
4. multi-touch or weighted attribution

Changes in those areas should start as new scoped follow-on work, not as ad hoc runbook edits.
