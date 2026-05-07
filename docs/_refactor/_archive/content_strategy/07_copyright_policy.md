# Copyright Policy

## Guiding Principle

Respect the author. Protect the project. Serve the reader.

---

## Classification

### Public Domain — Can Embed Freely

Works published before 1927 (US copyright law), or whose specific translations
predate 1927. These may be quoted at any length, embedded in chapters,
narrated in audio, and served through the help system search corpus.

| Work | Author | Year | Translation |
|---|---|---|---|
| Meditations | Marcus Aurelius | ~170 AD | 1887 Collier/Zimmern |
| Enchiridion | Epictetus | ~135 AD | Pre-1927 |
| Morals/Benefits/Anger | Seneca | ~65 AD | Pre-1927 |
| Apology | Plato | ~399 BC | Pre-1927 |
| Republic | Plato | ~380 BC | Pre-1927 |
| Nicomachean Ethics | Aristotle | ~340 BC | Pre-1927 |
| Essays | Emerson | 1841 | Original |
| Advancement of Learning | Francis Bacon | 1605 | Original |
| In Praise of Folly | Erasmus | 1511 | Pre-1927 |
| 95 Theses | Martin Luther | 1517 | Pre-1927 |

**Rule:** Attribute author and work. No further permission required.

### Copyrighted — Fair Use Only

Works published after 1927 with living authors or active estates.
These may be cited under fair use for the purpose of commentary,
criticism, and education — but substantial reproduction is prohibited.

| Work | Author | Year | Status |
|---|---|---|---|
| Antifragile | Nassim Taleb | 2012 | © Active |
| Pre-Suasion | Robert Cialdini | 2016 | © Active |
| Influence | Robert Cialdini | 1984 | © Active |
| The Hero and the Outlaw | Mark & Pearson | 2001 | © Active |
| Positioning | Ries & Trout | 1981 | © Active |
| 22 Laws of Branding | Ries & Ries | 1998 | © Active |
| 22 Laws of Marketing | Ries & Trout | 1993 | © Active |
| Blink | Malcolm Gladwell | 2005 | © Active |

---

## What We Can Do

### With Public Domain Texts
- Quote passages of any length with attribution
- Embed full passages in chapter prose
- Narrate passages via TTS for chapter audio
- Serve full passages via search corpus
- Include in the MCP Public Knowledge tool responses

### With Copyrighted Works (Fair Use)
- Quote brief passages (1–3 sentences) with full attribution
- Summarize key concepts in our own words (Operational Briefings)
- Comment on and critique the ideas
- Reference in the Reading Armory with bibliographic data
- Direct the reader to purchase the original

### What We Cannot Do
- Reproduce substantial portions of copyrighted text
- Include full transcripts in published chapters
- Create derivative works that substitute for the original
- Distribute transcripts (these are INTERNAL research files only)

---

## Internal vs. Published

| Content | Status | Location |
|---|---|---|
| Full transcripts of copyrighted books | INTERNAL ONLY — never published | `reference/transcripts/` |
| Full text of copyrighted books | INTERNAL ONLY — never published | `reference/antifragile.txt` |
| Public domain full texts | CAN PUBLISH | `reference/classics/`, `reference/meditations.txt` |
| Our original Operational Briefings | CAN PUBLISH (original work) | Embedded in Book I chapters |
| Fair use quotations | CAN PUBLISH (with attribution) | Embedded in Book I chapters |

---

## Attribution Format

### In-text (Book I prose)
> *"Do not act as if you had ten thousand years to throw away."*
> — Marcus Aurelius, *Meditations*, Book IV.17

### Operational Briefing header (for copyrighted works)
> **Operational Briefing: Antifragile** (Nassim Nicholas Taleb, 2012)
> *This is not a substitute for reading the original. Go buy it.*

### Reading Armory entry
Standard bibliographic format with "Why it matters" annotation.

---

---

## Git Hygiene

Copyrighted reference materials are **local-only context files** used for LLM research. They must NEVER enter version control.

### .gitignore Rules (to add to project root)

```gitignore
# Copyrighted reference materials (local LLM context only)
docs/content_strategy/reference/antifragile.txt
docs/content_strategy/reference/transcripts/
```

### What IS Tracked in Git

| Path | Why |
|---|---|
| `reference/classics/` | Public domain (pre-1927). These belong to humanity. |
| `reference/meditations.txt` | Public domain (Marcus Aurelius, 1887 Collier translation) |
| `reference/article_aging.md` | Published Harvard research article (fair use citation) |
| `reference/5th_avenue_1900_1913.webp` | Historical photograph (public domain) |
| `reference/README.md` | Directory documentation |

### What Is NOT Tracked in Git

| Path | Why |
|---|---|
| `reference/antifragile.txt` | © Nassim Taleb 2012. Personal copy for LLM context only. |
| `reference/transcripts/*.txt` | © Various authors. Personal copies for LLM context only. |

### Verification

After adding gitignore rules, verify with:
```bash
git ls-files docs/content_strategy/reference/antifragile.txt
git ls-files docs/content_strategy/reference/transcripts/
```

If these return results, the files are already tracked and need to be removed from the index:
```bash
git rm --cached docs/content_strategy/reference/antifragile.txt
git rm --cached -r docs/content_strategy/reference/transcripts/
```

---

*This policy protects us legally while maximizing the intellectual power
of the source material. The ancient philosophers wrote for everyone.
The modern authors wrote for purchase. We respect both.*

*Updated by Claude — gitignore hygiene added.*
