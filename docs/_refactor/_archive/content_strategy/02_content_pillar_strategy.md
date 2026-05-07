# Content Pillar Strategy: Library → Journal → LinkedIn

## Purpose

Every book chapter is a **content pillar** that produces 2–4 shareable journal articles. The journal is the distribution engine. LinkedIn is the acquisition channel. The library is the authority backstop.

**Flow:** LinkedIn post → Journal article (public, SEO'd, OG-tagged) → Library chapter (full, searchable) → Chat (interactive, personalized)

---

## The Six Pillars

### Pillar 1: The Inversion
**Book chapters:** I: Part I (Ch 1–5)
**Journal section:** Essay
**LinkedIn positioning:** "The world changed. Here's the evidence."
**Audience:** Mid-career professionals sensing the shift but lacking a framework

| Article Seed | Source Chapter | Brief |
|---|---|---|
| "Why 13 Years Is All You Get" | Ch 1: The Photograph | The 5th Avenue test applied to careers in the AI era. The 1900-1913 transition repeated. |
| "You Cannot Outrun the Bugatti" | Ch 2: The Bugatti | Why competing directly with AI at cognitive labor is a losing strategy. What to do instead. |
| "4 Proofs the Inversion Is Already Here" | Ch 3: The Evidence | AlphaEvolve, Sinclair, Mythos, NIF — the evidence trail laid flat. |
| "The Socratic Divide Is Now Visible" | Ch 4: The Socratic Divide | Elites learned to ask questions. Everyone else learned compliance. AI made the gap visible. |
| "The Institutions Are Sinking" | Ch 5: The Titanic | The lights are still on. The lifeboats are launching. What April 15 means — twice. |

---

### Pillar 2: Identity Architecture
**Book chapters:** I: Part II (Ch 6–9)
**Journal section:** Essay
**LinkedIn positioning:** "Who you are matters more than what you do."
**Audience:** People in career transitions or identity crises

| Article Seed | Source Chapter | Brief |
|---|---|---|
| "A Dart, a Stroke, and the Voice That Remained" | Ch 6: The Dart | The Architect's memoir condensed. Vulnerability as authority proof. |
| "You Are Not Your Resume" | Ch 7: The Outlaw-Sage | The archetype framework for professional identity. 12 archetypes explained. |
| "ADHD Is Not a Bug" | Ch 8: The Internal Cockpit | Neurodivergence as a feature requiring structural support. How the system was built for it. |
| "The One Skill That Compounds" | Ch 9: The Question Engine | Asking questions is the meta-skill. Every other skill decays; this one compounds. |

---

### Pillar 3: Trust Engineering
**Book chapters:** I: Part III (Ch 10–13)
**Journal section:** Briefing
**LinkedIn positioning:** "How trust actually works. The science."
**Audience:** Solopreneurs, consultants, people building client relationships

| Article Seed | Source Chapter | Brief |
|---|---|---|
| "The Analog Handshake Still Wins" | Ch 10: The Analog Handshake | Why the QR code on a business card outperforms every digital funnel. Granovetter's weak ties operationalized. |
| "The 6 Forces of Persuasion" | Ch 11: The Persuasion Engine | Cialdini's principles as system design, not manipulation. |
| "Positioning Is Not Marketing" | Ch 12: The Signal Stack | You own one slot in someone's mind. How to claim it. Ries & Trout applied. |
| "Carnegie Was Right About Trust, Wrong About the Smile" | Ch 13: Carnegie Rebuilt | Trust is proof of work, not warmth of affect. How the CRM pipeline proves you followed up. |

---

### Pillar 4: The Sovereign Stack
**Book chapters:** I: Part IV (Ch 14–17)
**Journal section:** Briefing
**LinkedIn positioning:** "Build this for $10/month. Own your data."
**Audience:** Technical solopreneurs, indie hackers, AI-curious builders

| Article Seed | Source Chapter | Brief |
|---|---|---|
| "The Iron Man Suit for Solopreneurs" | Ch 14: The Iron Man Suit | What a cognitive exoskeleton looks like. The system architecture walkthrough. |
| "SQLite, Docker, $10/Month" | Ch 15: The $10 Sovereignty Stack | No corporate cloud dependency. Your data stays on your machine. The sovereignty thesis. |
| "The Machine That Works While You Sleep" | Ch 16: The Deferred Worker | The deferred job system: how background workers process leads, send emails, and prepare morning briefings. |
| "Every Tool Is a Spec, Not Code" | Ch 17: The Capability Catalog | How the cockpit grows by writing specifications, not code. The extensibility thesis. |

---

### Pillar 5: The Formation
**Book chapters:** I: Part V (Ch 18–22)
**Journal section:** Essay
**LinkedIn positioning:** "You don't have to do this alone."
**Audience:** People who feel isolated in the solopreneur journey

| Article Seed | Source Chapter | Brief |
|---|---|---|
| "The Ordo: A Permanent Formation" | Ch 18: The Ordo | Why community isn't optional. The node-in-a-network thesis. |
| "Sovereignty Without Obligation Is Extraction" | Ch 19: The Covenant | The ethical obligations of the sovereign solopreneur. Aristotle's phronesis applied. |
| "The Reading Armory" | Ch 20: The Armory | The 2,400-year reading list. Ancient wisdom is free. Modern application costs money. Go buy it. |

---

### Pillar 6: Operator's Playbook
**Book chapters:** II: All
**Journal section:** Briefing
**LinkedIn positioning:** "Do this tomorrow morning."
**Audience:** Existing users and prospects ready to act

| Article Seed | Source Chapter | Brief |
|---|---|---|
| "Your First Day in the Cockpit" | II: Ch 1 | Login to first conversation. The onboarding walkthrough. |
| "Setting Up Your Identity Signal" | II: Ch 2–3 | Archetype selection + QR code setup. Action-oriented. |
| "Your Daily Practice (30 Minutes)" | II: Ch 8 (approx) | Morning review, cockpit check, evening reflection. The concrete daily ritual. |

---

## Production Pipeline

### How Articles Get Produced

1. **Source:** Chapter frontmatter contains `journal_seeds` — pre-written briefs with audience, section, and objective
2. **Compose:** Use `produce_blog_article` tool with the seed brief → AI composes, QA reviews, resolves findings, designs hero image, generates hero image, persists draft
3. **Review:** Admin reviews via `prepare_journal_post_for_publish` → checks editorial blockers
4. **Polish:** Update metadata (standfirst, section, slug) via `update_journal_metadata`
5. **Publish:** `publish_journal_post` → article goes live at `/journal/[slug]` with full OG tags and hero image

### Article Structure for LinkedIn

Every journal article follows this structure for maximum social sharing:
- **Hero image** — 1200×630, generated via pipeline, serves as OG image
- **Standfirst** — 1–2 sentences, serves as meta description AND LinkedIn preview text
- **Body** — 800–1200 words (5 min read target for Essays, 3 min for Briefings)
- **Back-link** — "This essay is drawn from Chapter N of The Field Guide. [Read the full chapter →]"
- **Chat hook** — "Have questions? [Ask the AI →]" with `?topic=` link

### Canonical URLs and Social Sharing

```
LinkedIn post → https://studio-ordo.com/journal/why-13-years-is-all-you-get
Journal article → links to → https://studio-ordo.com/library/field-guide/ch01-the-photograph
Chapter page → links to → chat via /?topic=The%20Photograph
```

Every surface has proper Open Graph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`. Every surface appears in the sitemap. Every surface is crawlable.

---

## Metrics

| Metric | Target | Measurement |
|---|---|---|
| Articles seeded | 20+ from chapter frontmatter | Count of `journal_seeds` across all chapters |
| Articles published | 10 in first 30 days | Journal post count |
| Lighthouse score | 100 (SEO category) | Lighthouse CI |
| LinkedIn impressions | 5K/week by month 2 | LinkedIn analytics |
| Library → Chat conversion | 15% of chapter readers engage chat | Plausible events |
