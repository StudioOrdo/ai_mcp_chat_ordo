# Product Story Reuse Map

This document maps the product story to existing functionality.

## Ordo As A Small Team

| Team role | What the user experiences | Existing functionality |
| --- | --- | --- |
| Chief of staff | "Here is what needs your decision today." | `UserDashboard`, `activity_taxonomy`, `activity_receipts`, operator transition projections |
| Researcher | "I found the relevant context and sources." | corpus tools, conversation search, relationship memory, admin web search |
| Producer | "I made the chart, graph, audio, image, or video." | media capabilities, `media_workflows`, `user_files`, FFmpeg/browser/server composition |
| Reviewer | "This draft needs one revision before publishing." | blog QA capabilities, operation confirmation actions, content revisions |
| Publisher | "This is ready for the public feed or private sharing." | `blog_posts`, publish capabilities, Feed read model, `ContentAudience` donor |
| Relationship keeper | "This person came through this QR code and is at this stage." | referrals, referral events, lead/deal records, relationship memory |
| Offer assistant | "This public or private offer is ready to use." | durable `offers`, offer page donor, static service seeds |
| Records officer | "Here is how this was made and what changed." | operations, materialization records, prompt provenance, Ordo detail lenses |
| Staff reporter | "Here is the brief, the recommendation, and the evidence." | dashboard/studio/business/admin loaders, future brief update requests, backup/restore execution pattern |

## Founder Workflow Proof

The first high-value loop should use what already exists:

1. Research a topic.
   - Current donors: corpus search, conversation recall, admin web search.
   - Gap: owner-safe web research capability and source pack object.
2. Synthesize research into an article.
   - Current donors: blog production and QA capabilities.
   - Gap: owner-facing content workflow outside admin journal.
3. Create a script.
   - Current donors: content drafting and QA loop.
   - Gap: explicit script object and QA profile.
4. Create an image, chart, or graph.
   - Current donors: generate chart, generate graph, blog image generation.
   - Gap: unified media request card and asset picker.
5. Generate audio.
   - Current donors: `generate_audio`, audio generation service, user files.
6. Compose a short.
   - Current donors: `compose_media`, media workflow read model, FFmpeg runtime.
7. Publish or share selected outputs.
   - Current donors: blog publish flow, Feed read model, `ContentAudience`
     model.
   - Gap: audio/short feed variants and private content sharing.
8. Track results.
   - Current donors: referral analytics, route metrics, activity, content
     tracked links, content-performance campaign read model.
   - Gap: media/campaign-specific tracked-link validators and durable
     campaign/pillar authoring.
9. Follow up with people.
   - Current donors: referrals, lead records, deal records, relationship memory.
   - Gap: People cards and relationship trail.
10. Create or revise the offer.
   - Current donors: durable offers, public offer publishing, static service
     seeds, admin prioritization.
   - Gap: private proposal grants and purchase completion state.

## Business Loop

The product story is not "make content." It is:

1. Create useful public or private content.
2. Attach a tracked link or QR code.
3. Bring a person into a relationship trail.
4. Match the person to a public or private offer.
5. Record purchase, simulated purchase, or next step.
6. Show what content, link, person, offer, or referral produced the result.
7. Recommend the next useful action.

This loop is the bridge between Studio and People.

## Public Product Story

The public site should show less and mean more:

- Home: "Ask Ordo."
- Public Offers: "Here is how this business can help, with prices."
- About: "This is why Ordo exists and why the operator can help."
- Feed: "Here is public work the operator chose to share."

The current public shell already supports this. The main cleanup is reducing
legacy routes, making Feed conditional, and keeping private content off public
surfaces.

## Authenticated Product Story

The owner should see:

- Conversations: where I tell Ordo what to do now and later review human handoffs
- Today: what needs me
- Studio: what Ordo made or is making
- People: who is involved and what stage they are in
- Offers: public offers, private offers, prices, and purchase state
- Account: who I am, my referral link, and my preferences

Admin and diagnostics should not interrupt this path.

## Public And Private Content

Content should not be binary "blog or not blog." It should have intent and
visibility.

| Content mode | User meaning | Code donor |
| --- | --- | --- |
| Public content | Published material for visitors, feed, search, and tracked links. | `blog_posts.status`, `blog_assets.visibility`, `/feed` |
| Private content | Material shared with a person, account, member group, or role. | `ContentAudience`, `roleVisibility`, corpus access |
| Internal draft | Work not ready for anyone outside the owner/team. | `blog_posts.status = draft`, Studio cards |
| Staff/admin content | Operator manuals, diagnostics, and governance docs. | `staff` and `admin` audiences |

## Public And Private Offers

Offers should carry intent and visibility.

| Offer mode | User meaning | Current donor | Gap |
| --- | --- | --- | --- |
| Public offer | Visible to visitors and eligible for public QR/link attribution. | `/offers`, durable `offers` model | Private proposal grants and simulated purchase completion |
| Private offer | Sent to a specific person/account or role after a conversation. | none sufficient | Offer visibility, recipient binding, simulated purchase |
| Internal draft | Owner/team-only offer in progress. | static config as seed only | Draft/publish workflow |

## The Most Useful Existing Story Assets

These features should be emphasized in the product because they already prove
the thesis:

1. Conversation renders real work cards and action buttons.
2. Background work is durable and inspectable.
3. Media workflows can compose complex assets.
4. QR/referral attribution already has meaningful milestones.
5. Relationship memory already preserves goals and commitments.
6. Content access control already exists through `ContentAudience`.
7. Cards already have role visibility.
8. The system has a real operation/approval model.
9. The appliance work proves Ordo can be self-hosted and recoverable.

## What To Stop Leading With

Do not lead with:

- tool catalog breadth
- admin pages
- job queues
- implementation runtimes
- library as public destination
- "AI can do anything" messaging

Lead with:

- "Ordo helps you run your business like you have a team."
- "Ordo shows what it did."
- "Ordo helps turn content and relationships into results."
- "Ordo helps you make offers people can act on."
- "You stay in control."
