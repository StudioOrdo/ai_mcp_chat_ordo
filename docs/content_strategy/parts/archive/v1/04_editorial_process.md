# Production Process: Concentrating Intelligence Through Iteration

## Philosophy

1. **Intelligence concentrates through iteration.** Each phase produces a more compressed, refined artifact.
2. **Names are semantic compression algorithms.** Historical figures and their works activate entire frameworks in minimal words.
3. **Know when to go broad vs. deep.** Research goes broad. Drafting goes deep. QA goes broad. Revision goes deep.
4. **The AI is a governed employee.** It accelerates discovery, drafting, and QA. It does not replace editorial judgment or the Architect's voice.
5. **The system is self-proving.** The process of creating the corpus demonstrates the thesis the corpus describes.
6. **The 11pm Test.** Every editorial decision is measured against: *Would the 38-year-old woman in Newark, who just got laid off, keep reading this at 11pm?* If no, the chapter fails.
7. **Tonal Benchmark.** The stroke scene in `08_multimedia_pipeline.md` is the quality standard. If a chapter is flat by comparison, it needs revision.

---

## Scope: Three Books

| Book | Chapters | Priority | Est. Sessions |
|---|---|---|---|
| **I: The Field Guide** | 22 chapters (5 parts) | First | 8–12 |
| **II: The Operator's Handbook** | 12 chapters (2 tracks) | Second | 4–6 |
| **III: The Architecture Reference** | 11 chapters | Third | 3–5 |
| **Total** | **45 chapters** | | **15–23 sessions** |

---

## Phase 0: Planning (CURRENT)

**Goal:** Complete the content strategy folder so all subsequent work is execution, not discussion.

**Deliverables:**
- [x] `00_executive_summary.md` — Master thesis, 3-book structure, voice, lineage
- [x] `01_master_outline.md` — Complete structural skeleton, all 43 chapters
- [x] `02_asset_inventory.md` — All visual/media/source assets mapped to chapters
- [x] `03_technical_audit.md` — Corpus rendering system, deployment plan, constraints
- [x] `04_editorial_process.md` — This document
- [x] `05_reading_armory.md` — Annotated reading list
- [x] `06_thesis_compression.md` — Canonical one-line thesis statements
- [x] `07_copyright_policy.md` — Legal framework for source usage
- [x] `08_multimedia_pipeline.md` — eai + Ordo tool integration for audio/visual production
- [x] `specs/mcp-public-knowledge-tool.md` — MCP tool spec for future implementation

**Exit Gate:** Architect reviews complete content_strategy folder and approves.

---

## Phase 1: Book I Drafting

**Goal:** Draft all 22 chapters of The Field Guide.

**Process per chapter:**

### Step 1: Draft
Write the full chapter prose using the dual-voice format.
- Architect's voice is written first
- Machine's fourth-wall breaks are woven in after
- Visual asset placements are embedded during drafting
- Reading armory briefings appear at natural narrative points
- Public domain texts are quoted with full passages
- Copyrighted works get compressed operational briefings

### Step 2: QA Pass 1 — Structural
- [ ] Does the chapter match its outline thesis?
- [ ] Is the primary thesis clear in the first paragraph?
- [ ] Is the dual-voice device consistent and in character?
- [ ] Are cross-references to other chapters accurate?
- [ ] Is every visual asset placed at a natural narrative breakpoint?
- [ ] Is the reading armory entry earned, not bolted-on?
- [ ] Is the chapter under 5 pages? (ADHD-friendly constraint)

### Step 3: Revision 1
Fix architecture. Do not polish prose yet.

### Step 4: QA Pass 2 — Editorial
- [ ] Would a scared person at 11pm keep reading?
- [ ] Is the tone honest without being nihilistic?
- [ ] Are all historical claims accurate and sourced?
- [ ] Are all system references technically correct?
- [ ] Does the Machine's voice provide genuine operational value?
- [ ] Read aloud test: does it sound like a human wrote the Architect parts?
- [ ] Does this chapter's emotional weight match the tonal benchmark (the stroke scene)?
- [ ] Does the chapter pass the 11pm Test? Would she keep reading?

### Step 5: Revision 2
Polish. Tighten. Remove every sentence that does not carry load.

**Exit Gate:** Each chapter passes both QA checklists before the next begins.

---

## Failure Protocol

What happens when a chapter fails QA.

1. **One failed QA pass** → Normal revision. Fix specific issues.
2. **Two failed QA passes** → The problem is architectural, not editorial. Restructure the chapter's thesis. The premise may be wrong.
3. **Three failed QA passes** → Combine with an adjacent chapter (the idea may not be strong enough to stand alone) or split into two shorter ones (the idea may be too big for the chapter constraint).
4. **Voice authenticity failure** → The Architect's sections sound forced or academic. Flag for the Architect to rewrite from lived experience, not from outline. If the Architect has nothing personal to say about the topic, the chapter may not belong in Book I.
5. **11pm Test failure** → The chapter is correct but boring. Apply via negativa: cut every sentence that does not carry load. What remains will be stronger.

---

## Phase 2: Book II Drafting

**Goal:** Draft all 12 chapters of The Operator's Handbook.

**Process:** Same 5-step flow, but with additional checklist items:
- [ ] Can the reader complete the task described without prior knowledge?
- [ ] Are screenshots/diagrams present for every non-obvious UI step?
- [ ] Is jargon eliminated in Track A?
- [ ] Does Track B add genuine depth, not just complexity?

---

## Phase 3: Book III Drafting

**Goal:** Draft all 11 chapters of The Architecture Reference.

**Process:** Same 5-step flow, but with additional checklist items:
- [ ] Is every claim verifiable against the current codebase?
- [ ] Are file paths and code references accurate?
- [ ] Could a competent engineer extend the system using only this chapter?
- [ ] Is the Machine's voice precise and deterministic (no hedging)?

---

## Phase 4: Integration QA

**Goal:** Ensure all three books function as one cohesive corpus.

### Cross-Book QA Pass 1 — Narrative Arc
- [ ] Does Book I create genuine urgency without inducing panic?
- [ ] Does the reader naturally want to open Book II after finishing Book I?
- [ ] Do cross-references between books resolve correctly?
- [ ] Is terminology 100% consistent across all three books?
- [ ] Does the "asking questions" meta-skill thread appear across all books?
- [ ] Is the Architect's biography distributed across Book I (not clustered)?

### Cross-Book Revision
Address systemic issues.

### Cross-Book QA Pass 2 — Final Polish
- [ ] Read Book I in one sitting. Mark every attention drop.
- [ ] Verify every cross-reference.
- [ ] Verify every visual asset renders correctly.
- [ ] Final terminology audit.

---

## Phase 5: Technical Deployment

**Goal:** Deploy the finished books into the live Studio Ordo system.

1. Archive all old `_corpus` books to `_archive/`
2. Create `field-guide/`, `operators-handbook/`, `architecture-reference/` with `book.json` manifests
3. Deploy all chapters as markdown files with `ch##-slug.md` naming
4. Wire visual assets
5. Generate audio files (`eai speak`) for Book I chapters
6. Verify search index ingests all new content
7. Run release gates:
   - `npm run quality`
   - `npm run build`
   - `npm run scan:secrets`
   - `npm run qa:runtime-integrity`
8. Test search queries:
   - "how do I track my leads?" → hits Book II
   - "why should I care about archetypes?" → hits Book I
   - "how does the job worker retry?" → hits Book III

---

## Production Order Summary

| Phase | Focus | Sessions | Exit Gate |
|---|---|---|---|
| **0** | Planning | 1–2 | Content strategy folder complete ✅ |
| **1** | Book I: Field Guide | 8–12 | 22 chapters pass 2x QA |
| **2** | Book II: Operator's Handbook | 4–6 | 12 chapters pass 2x QA |
| **3** | Book III: Architecture Reference | 3–5 | 11 chapters pass 2x QA |
| **4** | Integration QA | 2–3 | Cross-book QA passes |
| **5** | Technical Deployment | 1–2 | All release gates pass |
| | **Total** | **19–30 sessions** | |

---

*This process concentrates intelligence by iteratively compressing broad research into structured outlines, outlines into dense prose, and prose into verified, deployable knowledge. Each phase strips noise and strengthens signal.*

*Designed by Claude. Governed by the Architect.*
