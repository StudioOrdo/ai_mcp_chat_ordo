# Target Product Shape

## One Sentence

Ordo is an agent-ready business appliance that turns solopreneur intent into
governed, inspectable, repeatable work.

## User-Facing Promise

A solopreneur can talk to Ordo and ask for a business outcome. Ordo can research,
produce, review, publish, track, and preserve the workflow so it can be repeated
or improved later.

## View Model

The same business should project to different audiences:

- Humans see homepage chat, feed, offers, about, account, media, and workflow
  surfaces.
- Anonymous agents see public machine-readable business facts, offers, feed
  entries, and allowed request paths.
- Trusted agents eventually see scoped task request surfaces.
- Staff see workflow, content, risk, and service operations.
- Admins see configuration, users, capabilities, backups, jobs, publishing,
  metrics, and policy.

This is one business with multiple governed views, not separate products.

## Public Pages

### Homepage

The homepage should make chat the hero. The default first message is the primary
CTA, supported by a small number of intent buttons.

Current route: `src/app/page.tsx`

### Feed

The feed is not a blog. It is the public output stream of the business.

Feed item kinds:

- `article`
- `audio_episode`
- `short`
- `release_note`
- `field_note`
- `case_study`

Format projections:

- `/feed` - HTML
- `/feed.xml` - RSS
- `/feed.json` - JSON Feed
- `/feed/podcast.xml` - podcast RSS with audio enclosures

### Offers

Offers describe concrete next actions a visitor, customer, or agent can take.
They should use `config/identity.json`, `config/services.json`, and later
SQLite-backed admin configuration instead of hard-coded marketing copy.

### About

About explains the mission and the operating process. It should be concise and
aligned with `docs/_business/ordo_process.md`.

### Internal Corpus And Knowledge

The corpus is what Ordo knows, not what the public site shows.

There is no public library in the target product shape. Public visitors see
feed items and offers. Staff/admin users and governed agents may use internal
corpus, knowledge, asset, and content surfaces behind access control.

Internal corpus outputs should be referenced by durable IDs and projected to the
public feed only after an explicit publish decision.

## Internal Work Model

### Workflow

A workflow is a repeatable process template. It has versions, and runs point to
the exact version they executed.

### Operation

An operation is durable execution truth. It owns state, actions, confirmations,
events, and artifacts.

### Asset

An asset is any durable reusable output or input: article, script, source,
image, chart, graph, audio, video, transcript, brief, feed item, or file.

### Review

A review records QA state for an artifact or workflow run. Review depth is:

- `none`
- `standard`
- `intermediate`
- `aggressive`

### Metrics

Metrics connect output to outcomes: QR visits, feed views, audio downloads,
signups, account creation, workflow completion, and conversions.

## Migration Principle

Current feature-specific systems are donor systems. Preserve their behavior,
not necessarily their names.

Examples:

- Journal/blog becomes public feed and content workflow, then the old public
  route names are deleted when replacements pass.
- Blog QA becomes generic review.
- Media workflow becomes a reusable asset production step.
- Referral campaign presets become campaign/KPI primitives.
- Factory work orders remain useful for software work, but content workflows
  should not inherit software-only vocabulary.
