# Feature Spec: Journal Content Pillar Seeding

**Status:** Draft Spec — Not Yet Implemented
**Priority:** Phase 3 (after corpus scaffold + first chapter draft)
**Execution Surface:** Blog production pipeline (existing tools)
**Dependencies:** `produce_blog_article` tool, `journal-write.tool.ts`, chapter frontmatter with `journal_seeds`

---

## Purpose

Batch-produce LinkedIn-optimized journal articles from pre-written briefs embedded in chapter frontmatter. Each article is a self-contained piece that drives traffic back to the source chapter and positions Studio Ordo's six content pillars across LinkedIn.

---

## How It Works

### 1. Source: Chapter Frontmatter

Each chapter contains `journal_seeds` — pre-written briefs:

```yaml
journal_seeds:
  - brief: "Why 13 years is all you get"
    section: essay
    target_audience: "Mid-career professionals on LinkedIn"
    objective: "Drive traffic to the full chapter"
    tone: "urgent, evidence-backed, accessible"
```

### 2. Production: Existing Pipeline

The system already has the full pipeline. No new tools needed:

```
produce_blog_article(brief, audience, objective, tone)
  → compose_blog_article (AI writes the draft)
  → qa_blog_article (AI reviews for quality)
  → resolve_blog_article_qa (AI fixes issues)
  → generate_blog_image_prompt (AI designs hero image)
  → blog_image generation (creates 1200×630 hero)
  → persist blog post draft with hero image
```

### 3. Editorial: Existing Workflow

```
draft → review → approved → published
```

Each seed becomes a draft. The admin (via chat) reviews, polishes metadata (standfirst, section, slug), and publishes.

### 4. Distribution: Canonical Back-Links

Every produced article includes a canonical back-link paragraph:

```markdown
---

*This essay is drawn from [Chapter 1: The Photograph](/library/field-guide/ch01-the-photograph)
in The Field Guide. [Read the full chapter →](/library/field-guide/ch01-the-photograph)*

*Have questions? [Ask the AI →](/?topic=The%20Photograph)*
```

This creates the traffic loop: LinkedIn → Journal → Library → Chat.

---

## Production Batch Plan

### Wave 1: Launch Batch (5 articles)

High-impact articles that establish the six pillars. Target: publish 5 articles in the first week.

| # | Pillar | Article Title (working) | Source | Section |
|---|---|---|---|---|
| 1 | Inversion | "Why 13 Years Is All You Get" | Ch 1 | Essay |
| 2 | Identity | "A Dart, a Stroke, and the Voice That Remained" | Ch 6 | Essay |
| 3 | Trust | "The 6 Forces Nobody Told You About" | Ch 11 | Briefing |
| 4 | Sovereign Stack | "SQLite, Docker, $10/Month: The Sovereignty Stack" | Ch 15 | Briefing |
| 5 | Formation | "Sovereignty Without Obligation Is Extraction" | Ch 19 | Essay |

### Wave 2: Depth Batch (5 articles)

Second article per pillar. Target: publish in week 2.

| # | Pillar | Article Title (working) | Source | Section |
|---|---|---|---|---|
| 6 | Inversion | "You Cannot Outrun the Bugatti" | Ch 2 | Essay |
| 7 | Identity | "ADHD Is Not a Bug — It's a Feature Without a Cockpit" | Ch 8 | Essay |
| 8 | Trust | "The Analog Handshake Still Wins" | Ch 10 | Briefing |
| 9 | Sovereign Stack | "The Machine That Works While You Sleep" | Ch 16 | Briefing |
| 10 | Operator | "Your First Day in the Cockpit" | II: Ch 1 | Briefing |

### Wave 3: Fill Batch (10 articles)

Remaining seeds. Target: publish over weeks 3–4.

Drawn from remaining `journal_seeds` across all chapters. See `02_content_pillar_strategy.md` for the full article map.

---

## Article Specifications

### Structure (for `produce_blog_article` briefs)

Every article brief should include these implicit constraints:

- **Length:** 800–1200 words (5 min read for Essays, 3 min for Briefings)
- **Standfirst:** First paragraph serves as standfirst AND LinkedIn preview text
- **Headings:** 2–4 `##` headings for scannability
- **Closing:** Always include canonical back-link paragraph
- **No code blocks** in Essay articles (audience isn't technical)
- **Code blocks OK** in Briefing articles (audience is more technical)

### Hero Image Specifications

The `generate_blog_image_prompt` tool already handles this:

- **Size:** 1200×630 (LinkedIn + OG optimal)
- **Style:** Editorial, abstract, branded — not stock photography
- **Alt text:** Descriptive, accessibility-compliant
- **Quality:** High (suitable for LinkedIn large image cards)

### Metadata Specifications

Before publishing, each article needs:

```
slug: lowercase-hyphenated-title
title: Full Article Title
description: 1-2 sentence summary (serves as meta description + OG description)
standfirst: Opening statement (displayed large above body)
section: essay | briefing
hero_image: [selected from generated options]
```

---

## LinkedIn Posting Strategy

### Post Format

```
[Hook — 1 provocative line]

[2-3 sentence expansion]

[Link to journal article]

#StudioOrdo #Solopreneur #AI
```

### Example

```
You cannot outrun a Bugatti at cognitive labor. So stop trying.

The AI transition isn't coming — it's here. AlphaEvolve, Sinclair's
age-reversal, NIF fusion. The evidence trail is irrefutable.
The question isn't whether to adapt. It's whether you have 13 years.

Full essay: https://studio-ordo.com/journal/why-13-years-is-all-you-get

#AI #CareerTransition #Solopreneur
```

### Cadence

- **Week 1:** 5 articles (1/day, Mon–Fri)
- **Week 2:** 5 articles (1/day)
- **Weeks 3–4:** 2–3 articles/week
- **Ongoing:** 1–2 articles/week from new chapter drafts

---

## Metrics

| Metric | Target | Week 1 | Month 1 |
|---|---|---|---|
| Articles published | — | 5 | 20 |
| LinkedIn impressions | — | 2K | 15K |
| Journal page views | — | 500 | 5K |
| Library click-through | — | 50 | 500 |
| Chat engagements from `?topic=` | — | 10 | 100 |

---

*Spec drafted by Claude. For execution via the existing `produce_blog_article` pipeline — no new code required.*
