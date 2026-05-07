# Language And Vocabulary

## Naming Rule

Use words that describe the user's business, not the implementation.

The code can keep precise internal names like `job_requests`, `operations`,
`activity_receipts`, `roleVisibility`, and `ContentAudience`. User-facing copy
should translate those into business language.

## Term Policy

| Level | Meaning |
| --- | --- |
| Use | Preferred in normal product UI. |
| Avoid | Do not use in normal product UI. |
| Admin only | Acceptable in admin, diagnostics, or provenance details. |
| Developer only | Keep in code/tests/specs unless explaining the system. |

Default decisions:

- Use **Conversations** for the authenticated operating surface; use **Ordo**
  for the active agent conversation inside it.
- Use **Brief** for evidence-backed section/object summaries.
- Use **Work** in broad UI.
- Use **Run** inside detail and provenance views.
- Use **Job** only in admin diagnostics and developer docs.
- Use **People** for relationship management.
- Use **Relationship Trail** for the history of a person or relationship.
- Use **Provenance** for how work, media, content, and offers were made.

## Primary Surface Names

| Surface | User meaning | Policy | Existing anchors |
| --- | --- | --- | --- |
| Home | Start a conversation or public visit | Use | `src/app/page.tsx`, `src/frameworks/ui/ChatSurface.tsx` |
| Public Offers | What visitors can buy or request | Use | `src/app/offers/page.tsx`, `config/services.json` |
| Owner Offers | Create, price, revise, publish, or privately send offers | Use | Gap; seeded by `ServiceOffering` in `src/lib/config/defaults.ts` |
| About | Why this Ordo exists | Use | `src/app/about/page.tsx` |
| Feed | Published public content | Use only when content exists | `src/app/feed/page.tsx`, `blog_posts` |
| Conversations | Tell Ordo what to do and later manage human handoffs | Use | `src/frameworks/ui/ChatSurface.tsx` |
| Today | CEO daily brief: what needs me now | Use | `src/components/dashboard/UserDashboard.tsx` |
| Studio | Work, content, media, and production | Use | `src/components/studio/StudioWorkspace.tsx` |
| People | Relationships, customers, referrals, affiliates, conversations | Use | `src/components/business/BusinessWorkspace.tsx`, `referrals`, `lead_records` |
| Account | User info, password, preferences, theme, session | Use | `src/lib/profile/profile-service.ts` |
| Admin | System governance | Use for privileged users | `src/app/admin/**` |
| Jobs | Queue/background diagnostics | Admin only | `src/lib/admin/jobs/admin-jobs.ts` |
| System | Health, backups, restore, keys, governance | Admin only | `src/app/admin/system/**` |

## Object Vocabulary

| UI term | Internal terms it can cover | Policy | Notes |
| --- | --- | --- | --- |
| Work | job, workflow run, operation, factory work order | Use | Use when the user cares that Ordo is doing something. |
| Run | workflow run or governed operation | Use in details | Better than "job" when showing progress and provenance. |
| Brief | daily/section/object staff report | Use | Must be evidence-backed and inspectable. |
| Evidence Index | second-column selector/list | Use in docs/specs | The UI does not need this label unless helpful. |
| Media | audio, image, chart, graph, video, uploaded file | Use | Produced or reusable assets. |
| Content | article, post, script, feed item, public update, private note | Use | Material intended to be read, watched, heard, sent, or published. |
| Public Content | content visible to anonymous visitors | Use | Public feed and public pages only. |
| Private Content | content visible only to signed-in users, a role, or a selected person | Use | Ground in `ContentAudience` or owner/person-specific access. |
| Person | lead, customer, affiliate, referrer, visitor, collaborator | Use | Keep broad. Ordo manages relationships, not just customers. |
| Public Offer | service package, price, promise, buying path | Use | Visible on public offers page. |
| Private Offer | tailored proposal, private package, customer-specific offer | Use | Requires durable offer visibility model. |
| Link | referral QR, tracked URL, campaign link | Use | Use "tracked link" only in details/admin. |
| Provenance | source, prompt, job, operation, artifact, evidence | Use | For work/media/content/offers. |
| Relationship Trail | referral events, conversation, lead, deal, follow-up | Use | User-facing name for relationship provenance. |
| My Account | user info, password, preferences, theme, and session controls | Use | Account menu label. |
| Change Password | current-password verification and password update | Use | Account section label only; do not duplicate it in the account menu. |
| Affiliate Dashboard | owner affiliate/referral dashboard | Use | Account-menu shortcut to `/referrals`; not a profile sidebar section. |
| Referrals | owner affiliate/referral dashboard | Use | Business-development surface at `/referrals`. |
| Audience | public, member, account, premium, apprentice, staff, admin | Use in settings/details | Grounded in `ContentAudience`. |
| Trust Ledger | relationship/accounting architecture | Admin only | Use in docs/admin, not lightweight card copy. |

## Visibility Vocabulary

| UI label | Code anchor | User meaning |
| --- | --- | --- |
| Public | `ContentAudience: public`, public offer flag | Anyone can see it. |
| Members | `member` or `account` | Signed-in users can see it. |
| Premium | `premium` plus premium tier handling | Premium users, staff, and admin can see it. |
| Apprentice | `apprentice` | Apprentice, staff, and admin can see it. |
| Staff | `staff`, `roleVisibility` | Staff and admin can see it. |
| Admin | `admin`, `OperationVisibility: admin` | Admin only. |
| Private to person | future offer/content access rule | Only selected person/account plus owner/staff/admin. |
| Draft | `blog_posts.status`, `blog_assets.visibility` | Not public yet. |
| Published | `blog_posts.status`, `blog_assets.visibility` | Publicly visible when routed to a public surface. |

## Words To Avoid In Regular UX

| Avoid | Prefer | Policy |
| --- | --- | --- |
| Job | Work, run, production step | Admin only |
| Operation | Approval, protected action, governed work | Admin only |
| Dashboard | Brief, section overview | Avoid for owner UX |
| Activity receipt | Read state, attention state | Developer only |
| Capability | Skill, action Ordo can take | Developer only |
| Materialization | Produced artifact, reused output | Developer only |
| Prompt binding | Context used, instructions used | Developer only |
| Provider log | System diagnostics | Admin only |
| Workflow DAG | Steps, process | Developer only |
| Deferred | Running in the background | Admin only |
| Artifact | Output, media, file, result | Admin only |
| Tracked link | Link, QR link, referral link | Use in details only |
| Business page | People, Results, Offers | Avoid as nav label |
| My media | Studio | Avoid as account-menu label |
| My conversations | People or Conversations | Avoid as account-menu label |
| My offers | Offers | Avoid as account-menu label |
| My content | Studio | Avoid as account-menu label |

## Action Labels

Prefer direct verbs:

- Review
- Approve
- Publish
- Share
- Send privately
- Follow up
- Open
- Copy link
- Download QR
- View provenance
- View relationship trail
- Ask Ordo
- See results

Avoid vague labels:

- Manage
- Process
- Execute
- Trigger
- Inspect entity
- Open diagnostics

## Status Labels

| Internal state | User-facing label |
| --- | --- |
| queued | Waiting |
| running | In progress |
| blocked | Needs your decision |
| awaiting_confirmation | Ready for approval |
| succeeded | Ready |
| failed | Needs repair |
| canceled | Canceled |
| archived | History |

## Relationship Language

People should never feel like rows in a funnel. Use:

- "introduced by"
- "came from"
- "started a conversation"
- "asked about"
- "next follow-up"
- "offer they are considering"
- "relationship trail"

For analytics, use simple stages:

1. Visitor
2. Conversation
3. Contact
4. Offer
5. Purchased
6. Follow-up

The current schema already supports parts of this through `referrals`,
`referral_events`, `conversations`, `lead_records`, and `deal_records`.
