# Restore And Experience Specification

## Objective

Define the target return-user experience and the restore read model for the
greenfield conversation system.

## Product Principle

Restore should feel like walking back into an ongoing customer relationship.

It should not feel like replaying a log file.

## Current Problem

The current system can load historical transcript parts that still look like
recoverable browser or media runtime candidates. That makes old work eligible
for accidental reinterpretation.

This is a product failure, not just a bug.

The user asked to continue the relationship. They did not ask the system to
reprocess the past.

## Target Restore Flow

### Step 1: Resolve Identity

Restore starts by resolving ownership:

- authenticated user
- anonymous session
- pending migration state, if applicable

If migration is in progress, restore should prefer an explicit migration status
over guessing from partially transferred records.

### Step 2: Load Workspace Snapshot

The workspace snapshot is the first meaningful product object.

It should provide:

- active objective
- next best action
- open loops
- active job references
- important asset references
- memory summary reference

If no workspace snapshot exists, the system may create one from the active
conversation and recent state, but that should be a projection repair path, not
the normal runtime strategy.

### Step 3: Load Business Workflow Context

The business workflow context should answer why this conversation matters now.

It should provide:

- revenue, service, training, operations, setup, or general mode
- task-origin and return-to-source context
- related leads, deals, consultations, referrals, training paths, journal
  items, jobs, or assets
- lifecycle, onboarding, or coach progress
- interrupted or retryable user work
- terminal notifications that should become review actions
- health or setup blockers that affect the next action

For solopreneurs and small businesses, this is where the product becomes more
than chat. It becomes the lightweight business operating layer around the chat.

### Step 3.5: Load Operator Transition And Trust Distribution Context

The operator transition context should answer how the user is becoming more
economically effective.

It should provide:

- existing-business, new-offer, career-transition, community-affiliate, or
  admin-setup mode
- current activation status: discovering offer, building first motion, sharing,
  following up, or operating
- expertise, audience, and offer refs when available
- referral link, QR code, intro script, and physical-share asset refs
- recent trusted-introduction milestones
- follow-up, credit-review, or first-share recommendations
- setup blockers that prevent sharing, registration, follow-up, or payout review

For users who are not yet established operators, this is the difference between
"the chat loaded" and "I know what to do next with my life or business."

### Step 4: Load Active Work

Active work includes only jobs in active or attention-needed states:

- queued
- running
- failed
- canceled when retryable or attention-worthy
- dead letter when operator-visible

Succeeded jobs are not active work.

### Step 5: Load Reusable Assets

The restore surface should show a compact asset shelf for durable outputs.

The shelf should include:

- recent outputs
- pinned or canonical outputs
- assets referenced by open loops
- assets produced by recent jobs

It should not require scanning message parts to discover these assets.

### Step 6: Load Relationship Memory

The memory summary should answer:

- what this customer was trying to do
- what decisions were made
- what preferences matter
- what is unresolved
- what prior outputs matter now

This should be a structured memory projection, not just the latest summary
message.

### Step 7: Load Recent Transcript

The transcript slice should be recent and readable.

It should include enough context for trust, but it should not own restore state.

Older transcript history should be searchable and expandable.

## Homepage Experience

The signed-in homepage should present:

1. current work summary
2. business workflow context and next action
3. operator transition or trust-distribution next action when relevant
4. active work strip
5. reusable asset shelf
6. recent conversation
7. clear next action composer

The anonymous homepage may present the same pattern at smaller scope, but must
make eventual migration safe.

## Interaction Rules

### Historical Completed Work

When prior completed work exists, the UI should say:

- reuse
- revise
- duplicate as variant
- inspect job history

It should not silently rerun.

### Failed Or Canceled Work

Failed or canceled work should be visible as attention-needed work.

It should offer explicit actions:

- retry
- inspect failure
- dismiss from active workspace
- create new variant

### Running Work

Running work should be visible from durable job state.

Browser-local hints can improve display but cannot be authoritative.

### Old Transcript Tool Calls

Old tool calls should render as history.
They must not trigger execution on load.

## API Shape

Suggested restore endpoint:

```typescript
export interface WorkspaceRestoreResponse {
  workspace: WorkspaceSnapshot;
  activeJobs: readonly JobStatusProjection[];
  workflow: BusinessWorkflowContextProjection | null;
  operatorTransition: OperatorTransitionProjection | null;
  trustDistribution: TrustDistributionProjection | null;
  assets: readonly AssetCatalogProjection[];
  memory: RelationshipMemorySummary | null;
  recentTranscript: TranscriptSlice;
  migration: IdentityMigrationStatus | null;
}
```

## Definition Of Done

Restore is correct when:

- clearing browser session storage does not lose continuity
- old successful media does not rerun on page load
- active jobs match durable job state
- completed outputs are visible as reusable assets
- long conversations restore from memory and recent transcript, not full replay
- anonymous migration produces a coherent restored workspace after login
- first-run or transition users get an agency-oriented next action, not only an
  empty chat or setup screen
- referral/QR context restores as shareable trust-distribution state without
  scanning transcript tool cards
