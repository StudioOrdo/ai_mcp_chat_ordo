# UX North Star

## Product Promise

Tell Ordo what you are trying to accomplish. Ordo turns the request into
governed work, shows what happened, helps you improve it, and connects the
result to the business outcome you care about.

Chat is the operating interface. UI surfaces are the governance layer.

For the solo operator, the feeling should be:

- I know what Ordo can do for me.
- I know what Ordo is doing right now.
- I know what needs my decision.
- I can inspect how work was produced.
- I can create public and private offers.
- I can create public and private content.
- I can see whether my content, offers, and relationships are producing
  results.

## Human Frame

The user is the CEO of a very small business.

Ordo is not the CEO. Ordo is the operating staff the user does not yet have:

- chief of staff for next actions and coordination
- researcher for context gathering
- producer for media and content
- reviewer for QA loops
- publisher for feed and public surfaces
- relationship keeper for people, referrals, and follow-up
- records officer for provenance and accountability

The interface must preserve human dignity. It should help people regain agency
in the age of AI, not make them feel managed by software.

## Operating Loop

The product loop is:

1. State the intent in conversation.
2. Ground the request in evidence and context.
3. Turn it into governed work.
4. Produce an artifact, offer, content item, or relationship outcome.
5. Run the configured QA loop when the output needs review.
6. Publish, share, send privately, or follow up.
7. Measure what happened.
8. Recommend the next useful action.

The current business canon calls this discipline out in
`docs/_business/ordo_process.md` and `docs/_business/06_the_production_engine.md`.
The UI should make that loop visible without forcing users to learn the
internal names for every subsystem.

## Surface Model

Ordo should have a small number of obvious surfaces:

- **Home**: conversational entry point and public hero.
- **Public Offers**: what the business sells to visitors.
- **About**: why this Ordo exists and who it helps.
- **Feed**: public published content, only visible when public content exists.
- **Conversations**: authenticated operating surface for telling Ordo what to
  do now and, later, transferring relationship chats to a human operator.
- **Today**: CEO daily brief of what needs attention, what is moving, what is
  ready, and what to ask Ordo next.
- **Studio**: everything Ordo produces or is producing: work, media, content,
  workflows, campaigns, jobs-as-work, and artifacts.
- **People**: relationships, customers, referrals, affiliates, conversations,
  and follow-up.
- **Owner Offers**: private offer builder, public offer management, tailored
  proposals, prices, and simulated purchase state.
- **Account**: user info, password, preferences, theme, session controls, and a
  direct Affiliate Dashboard shortcut through the upper-right account menu. QR,
  referral links, and referral performance live in `/referrals`, not `/profile`.
- **Admin/System**: privileged system, jobs, backup/restore, diagnostics, and
  governance controls.

Library, raw jobs, operations, activity receipts, and diagnostic logs are not
primary product surfaces. They are donors, detail lenses, or admin tools.

## Progressive Disclosure

Owner surfaces should follow one disclosure path:

1. **Chat**: the user gives direction.
2. **Section brief**: Ordo explains what matters right now.
3. **Second-column evidence index**: objects and signals stay selectable.
4. **Selected detail**: one object gets the main pane.
5. **Trail/provenance**: the user can inspect how it got there.
6. **Admin diagnostics**: raw jobs, logs, providers, and repair controls stay
   role-gated.

This keeps Ordo simple without hiding accountability. A selected media asset,
person, offer, backup, or work item should never have section-wide dashboard
totals sitting above it. Totals belong in a section brief or compact
second-column overview.

## Visibility Model

Content already has a real access-control foundation:

- `public`: visible to anonymous visitors and all signed-in roles
- `member` and `account`: visible to signed-in users
- `premium`: visible to premium users plus staff/admin
- `apprentice`: visible to apprentice, staff, and admin roles
- `staff`: visible to staff and admin
- `admin`: visible only to admin

Code anchors:

- `src/lib/access/content-access.ts`
- `src/adapters/FileSystemCorpusRepository.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/lib/chat/retrieval-envelope.ts`
- `src/app/admin/content-visibility/page.tsx`

Offers need the same product distinction even though the durable offer model is
not built yet:

- **Public offer**: visible on the public offer page.
- **Private offer**: visible only to a selected person, account, or role.
- **Internal offer draft**: staff/admin or owner-only until published.

## Design Standard

The standard is Apple-level restraint with Steve Krug-level obviousness:

- one primary action per view or card
- plain labels before clever labels
- progressive disclosure instead of dense dashboards
- status that answers "what happened?" and "what should I do?"
- mobile-first controls for the day-to-day operator
- deep inspection available, but not pushed into the user's face

## Brief Standard

Briefs are Ordo's staff reports. Today, Studio, People, Offers, Account, and
System should each be able to show a brief before the user dives into objects.

A brief should be durable, evidence-backed, and inspectable:

- what changed;
- what matters;
- what needs a decision;
- what is blocked or moving;
- what worked;
- what Ordo recommends next;
- which evidence supports those claims.

The long-term brief executor should follow the same command/result/reconcile
discipline proven by the Rust backup and restore system.

## The Golden Path

The first complete product story should be:

1. A visitor arrives at the homepage or through a QR code.
2. The chat helps them understand the business and the current public offers.
3. The visitor becomes a person with a relationship trail.
4. The owner can create or revise public and private offers in chat or UI.
5. The owner can create content from research through a QA loop.
6. Ordo produces article/audio/short-form assets and saves the provenance.
7. The owner publishes selected work to the public feed or shares private
   content with a person or role.
8. Tracked links and QR codes show which people, content, or offers created
   motion.
9. Today shows what needs the owner now as a brief, with the evidence index in
   the second column.

This path should drive cleanup decisions. Features that do not support it
should be hidden, reframed, or pruned.
