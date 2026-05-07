# Reference Materials Directory

## What This Directory Contains

Source materials used for LLM context during content production. Some are public domain and tracked in git. Some are copyrighted personal copies and excluded from git.

## Directory Layout

```
reference/
├── classics/                    # Public domain (pre-1927) — TRACKED
│   ├── Aristotle - Nicomachean Ethics.txt
│   ├── Emerson - Essays.txt
│   ├── Epictetus - Enchiridion.txt
│   ├── Erasmus - In Praise of Folly.txt
│   ├── Francis Bacon - The Advancement of Learning.txt
│   ├── Martin Luther - 95 Theses.txt
│   ├── Plato - Apology.txt
│   ├── Plato - Republic.txt
│   └── Seneca - Morals of a Happy Life, Benefits, Anger and Clemency.txt
├── transcripts/                 # Copyrighted — LOCAL ONLY (gitignored)
│   ├── 22-laws-branding.txt
│   ├── 22-laws-marketing.txt
│   ├── blink.txt
│   ├── positioning.txt
│   ├── pre-suasion.txt
│   └── the-hero-and-the-outlaw.txt
├── meditations.txt              # Public domain (1887 Collier translation) — TRACKED
├── antifragile.txt              # © Nassim Taleb 2012 — LOCAL ONLY (gitignored)
├── article_aging.md             # Published Harvard research (fair use) — TRACKED
├── 5th_avenue_1900_1913.webp    # Historical photograph (public domain) — TRACKED
└── README.md                    # This file — TRACKED
```

## Copyright Classification

### ✅ Public Domain — Tracked in Git
All materials in `classics/` and the `meditations.txt` are public domain works (pre-1927 US copyright). These belong to humanity. They may be quoted, embedded, narrated, and served through the search corpus without restriction.

### ⚠️ Copyrighted — Local Only
`antifragile.txt` and all files in `transcripts/` are personal copies of copyrighted works. They are used ONLY as LLM context for research and content production. They are:
- **Gitignored** — never committed to version control
- **Never published** — never served to users
- **Never indexed** — the `reference/` directory is not crawled by `FileSystemCorpusRepository`
- **Personal use only** — the author owns legitimate copies of all referenced works

### Attribution Rule
Every copyrighted work referenced in the published corpus includes the refrain:
> *This is not a substitute for reading the original. Go buy it.*

## Structural Isolation

The `FileSystemCorpusRepository` crawls `docs/_corpus/` — NOT `docs/content_strategy/`. This directory is structurally isolated from the live search index, the sitemap, and all public-facing surfaces.

---

*See `07_copyright_policy.md` for the full copyright policy and gitignore rules.*
