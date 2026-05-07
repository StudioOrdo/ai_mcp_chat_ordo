# Message And Tone

## Voice

Ordo should sound like a calm chief of staff for the business owner.

The voice is:

- clear
- practical
- respectful
- specific
- quietly warm
- honest about uncertainty

The voice is not:

- salesy
- hype-driven
- patronizing
- performatively magical
- overloaded with internal system detail

## Public Visitor Tone

The anonymous homepage is the public face of the operator's business. It should
not sound like a salesperson trying to capture a lead. It should sound like the
CEO's capable assistant:

> Tell me what brought you here. I can explain the offers, answer questions, or
> help you decide whether this is the right fit.

If a visitor came from a QR code or referral, acknowledge it without pressure:

> You came through Keith's introduction. I can show you what this business does
> and help you decide the next useful step.

## Authenticated Owner Tone

The owner needs leverage, not cheerleading:

> Today: two items need review, one media run is in progress, and no new
> referral motion is measured yet.

> The draft is ready. Review the script first, then publish the audio when you
> are comfortable with it.

Section briefs should sound like a capable staff report:

> The most useful next action is to follow up with Ava. She asked about timing,
> the offer is ready, and the relationship trail shows no reply has been sent
> since May 4.

If evidence is incomplete, say so directly:

> Ordo does not have enough evidence to measure content performance yet.

## Visibility Tone

Visibility copy must be plain. Do not hide access control behind vague words.

Use:

- Public
- Draft
- Private to this person
- Signed-in members only
- Premium members only
- Staff only
- Admin only

Avoid:

- audience scoped
- access controlled entity
- role visibility applied
- restricted artifact

Content visibility should follow the code model in
`src/lib/access/content-access.ts`. Offer visibility should use the same plain
language even before the durable offer model exists.

## Required Copy Examples

| Situation | Recommended copy |
| --- | --- |
| Anonymous first visit | "Tell me what you are trying to do. I can explain the offers, answer questions, or help you decide the next useful step." |
| Referred visitor | "You came through Keith's introduction. I can show you what this business does and help you decide whether it fits." |
| First authenticated login | "Welcome. Start with one concrete business outcome. I can help you shape the offer, create content, or follow up with people." |
| No public offers | "No public offers are live yet. Create one offer so visitors understand how to work with you." |
| No private offers | "No private offers have been sent yet. Create one when a person needs a tailored next step." |
| Public offer ready | "This offer is ready for the public page." |
| Private offer ready | "This offer is ready to send privately. It will not appear on the public offers page." |
| No public feed content | "No public content yet. Publish only when you have something useful to share." |
| Private content ready | "This content is ready, but it is private. Share it with the selected person or change visibility before publishing." |
| First QR share | "Your QR link is ready. Share it when you meet someone; Ordo will connect visits, conversations, and next steps back to you." |
| Account referral link | "Your referral link is ready. Share it when you meet someone; Ordo will connect visits and conversations back to you." |
| Media run ready | "The audio is ready. Review it, then publish it or keep it private." |
| Failed media run | "The media run needs repair. Your source material and prior work are still preserved." |
| Access denied | "This content is not visible to your current role." |

## Empty States

Every empty state should answer:

1. What is this page for?
2. Why is it empty?
3. What should I do next?

Examples:

| Surface | Empty state |
| --- | --- |
| Today | "No active decisions yet. Start with one concrete outcome in Conversations." |
| Studio | "No media or content has been produced yet. Ask Ordo to make something you can publish or reuse." |
| People | "No relationship activity yet. Share your QR link or start a conversation with a visitor." |
| Public Offers | "No public offers are live yet. Create one offer so visitors understand how to work with you." |
| Owner Offers | "No private offers yet. Create one when a person needs a tailored proposal." |
| Feed | "No public content yet. Publish only when you have something useful to share." |

## Error States

Error copy should say what failed and what remains safe.

Bad:

> Something failed.

Better:

> The People page could not load. Your data is still preserved. Try again, or
> open Today while Ordo reloads the relationship signals.

For implementation errors, do not expose stack traces in regular UI. Provide a
diagnostic link only to staff/admin.

## Confirmation Copy

Destructive, private, or externally visible actions need direct confirmation.

Format:

1. What will happen.
2. Who will be able to see it.
3. What will not change.
4. Primary action.
5. Cancel action.

Public example:

> Publish this audio episode?
>
> It will appear in the public feed. The draft and provenance will remain
> available in Studio.

Buttons:

- Publish episode
- Keep as draft

Private example:

> Send this private offer?
>
> Only this person and your team will see it. The public offers page will not
> change.

Buttons:

- Send private offer
- Keep as draft

## Cards

Card text should be short. Cards are for recognition and action, not full
explanation.

Recommended pattern:

- Object label: Media, Person, Offer, Link, Content, Work
- Visibility: Public, Draft, Private, Staff only, Admin only when relevant
- Status: Ready, Needs review, In progress
- Title: human-readable
- Summary: one sentence
- Metrics: 2-4 useful facts
- Primary action: one obvious verb
- Secondary actions: no more than 3

## Provenance And Relationship Detail

Use disclosure text like:

- "See how this was made"
- "See the relationship trail"
- "See what changed"
- "See source material"
- "See who can view this"
- "See brief evidence"

Avoid:

- "View logs"
- "Inspect operation"
- "Open job"

Those can remain in admin/diagnostic views.
