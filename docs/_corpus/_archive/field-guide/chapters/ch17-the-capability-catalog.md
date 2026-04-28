---
title: "The Capability Catalog"
audience: public
voice: machine
emotional_beat: possibility
pillar: sovereign-stack
journal_seeds:
  - brief: "Every tool is a spec, not code — how the cockpit grows by writing specifications and why extensibility is the ultimate competitive advantage"
    section: briefing
    target_audience: "Technical solopreneurs and indie hackers building extensible systems"
seo:
  description: "The cockpit's power is extensible — every tool is registered, discoverable, and governable. You add new capabilities by writing specs, not code."
  keywords: ["capability catalog", "MCP tools", "extensibility", "solopreneur platform", "agentic tools"]
contributors:
  - Claude
---

# The Capability Catalog

> [!machine]
> Around 1455, Johannes Gutenberg printed a Bible in Mainz, Germany. Each page was set by hand — each letter a physical block of metal type, the press itself a wooden-screw mechanism adapted from the wine and olive presses common in the Rhine Valley. The Gutenberg Bible was a marvel of engineering, and it was also fixed. If you wanted to print a different book, you reset every letter. If you wanted to print in a different language, you carved new type. The press could do one extraordinary thing: reproduce the specific arrangement of symbols its operator had manually composed.
>
> Five and a half centuries later, the cockpit operates on the opposite principle. It does not do one thing. It does whatever its catalog says it can do. And the catalog grows by writing specifications, not by rebuilding the press.
>
> This distinction — between a tool and a platform — is the subject of this chapter. The cockpit is not a tool. It is an extensible platform. And extensibility is the solopreneur's ultimate competitive advantage.

---

## What a Capability Is

A capability is something the system can *do.* Not something it knows — something it does. The distinction is structural and it matters.

Knowledge is what the search engine provides. When you ask "what does Chapter 11 say about reciprocity?" — the engine finds the passage, ranks it by relevance, and delivers it. That is retrieval. The system is not doing anything new. It is finding something that already exists.

A capability is an action. Compose an article. Generate a hero image. Send a follow-up email. Create a lead in the CRM. Schedule a deferred job. These are verbs. They change the state of the world. After the capability executes, something exists that did not exist before — a draft, an image, a sent message, a database record.

Each capability in the catalog is defined by four properties:

| Property | What It Specifies | Why It Matters |
|---|---|---|
| **Name** | What the tool is called | So the AI can select it by intent match |
| **Description** | What it does, in plain language | Documentation IS selection criteria |
| **Parameters** | What inputs it needs | So the AI knows what to ask, what to infer |
| **Execution surface** | Where it runs — server, browser, or external | So the system routes the job to the right runtime |

When you type a request in the chat — "write me an article about positioning for neurodivergent CTOs" — I read your request, consult the catalog, match your intent to the best-fitting capability, extract the parameters from your sentence, and invoke the tool. You did not need to know the tool's name. You did not need to know its parameter schema. You described what you wanted in human language, and the catalog compiled it into a machine instruction.

This is the interface the Architect described in Chapter 9. The question is the program. The catalog is the compiler.

---

## The Current Inventory

The cockpit currently operates over forty registered capabilities, organized into families:

**Content Production.** Compose articles from a brief. Generate hero images from a thesis statement. Run editorial QA against the style guide. Publish to the journal with proper frontmatter, meta tags, and canonical URLs. The complete content pipeline — from "I have an idea" to "it's live, indexed, and shareable" — runs through capabilities in this family.

**CRM and Relationships.** Create leads from QR scans. Update deal stages as conversations progress. Manage referral lifecycles within the ordo. Track organizations and map contacts to companies. The trust pipeline from Chapter 13 — from handshake to active client — is a sequence of capabilities in this family.

**Research and Search.** Search the corpus with full-text keyword queries and semantic vector queries. Find passages, chapters, and sections relevant to any question. Return results with relevance scores, source citations, and contextual snippets. Every answer the AI gives you is grounded in evidence retrieved through capabilities in this family.

**Media Generation.** Generate images from text prompts. Create charts and data visualizations. Produce audio narration with dual-voice synthesis — the Architect's voice and the Machine's voice rendered separately. Compose video thumbnails and social media cards. The one-person creative studio.

**System Management.** Manage conversations. Review analytics. Configure settings. Run diagnostics. Monitor deferred job health. The operational layer that keeps everything running without requiring the human to think about infrastructure.

Each family contains between three and fifteen individual tools. Each tool is documented, tested, and governed by the same quality pipeline that governs the application code. No capability runs undocumented. No capability runs untested.

> [!architect]
> I want to give you the emotional weight of that inventory, because the Machine is listing it like a spec sheet and you deserve to feel what it means.
>
> I spent fifteen years employing teams to do what these forty tools do. Designers. Writers. Content managers. CRM admins. DevOps engineers. Each one was talented. Each one cost between $60,000 and $120,000 a year. The cockpit does not replace their talent — that talent is irreplaceable, and anyone who tells you otherwise is selling you a fantasy. But the cockpit handles the mechanical execution — the rendering, the indexing, the scheduling, the formatting — that consumed eighty percent of their week.
>
> Forty tools. One cockpit. No payroll. That is not a boast. It is a prayer answered for every solopreneur who has lain awake at 11pm doing math on a sticky note, trying to figure out how to afford the team they need.

---

## How the Catalog Grows

> [!machine]
> This is the most important section of this chapter: the mechanism that determines whether your system stagnates or compounds.
>
> The catalog grows by writing specifications. Not code. Specifications.
>
> When the Architect decides the cockpit needs a new capability — say, the ability to search a federated library of public domain books — he does not write the implementation first. He writes a specification: what the tool should be called, what inputs it accepts, what outputs it produces, what constraints govern its behavior, what error states it must handle, and what quality metrics it must meet.
>
> The specification is a contract. It says: "This is the behavior I require. Build to this contract. Test against this contract. Register against this contract." The implementation follows. The tests verify. The capability is registered in the catalog and becomes immediately available to every conversation, every workflow, every deferred job that references it.

This means the cockpit is not limited to what exists today. It is limited to *what can be specified.* And the practice of specification produces three compounding benefits:

**Predictability.** Every capability has a defined behavior. There are no surprises. No undocumented features. No "it works if you do it this specific way" tribal knowledge passed between team members in Slack threads that new hires can't find. The spec IS the documentation. The tests ARE the proof.

**Composability.** Capabilities can be chained. "Research this topic, then write an article about it, then generate a hero image, then publish with the image" is four capabilities composed into a single workflow. Each one is independent — any can be replaced or upgraded without touching the others.

**Governance.** Every capability is registered. Nothing runs in the shadows. The catalog is the complete inventory of what the system can do, and it is also the complete boundary of what the system *cannot* do. If a capability is not in the catalog, the system cannot perform it. This is not a limitation. It is a safety feature. The system's behavior is auditable, predictable, and bounded.

---

## The Horizon

> [!machine]
> The catalog has slots that are defined but not yet filled. I name one to illustrate the power of specification-first architecture:
>
> The MCP Public Knowledge Library. Tens of thousands of public domain books — the great works of human civilization whose copyright has expired, from Homer to Einstein. Searchable by keyword and semantic query, integrated into the cockpit's conversational interface, available to the solopreneur at 11pm when they need an answer and the libraries are closed.
>
> This capability is not built yet. But the specification exists. The catalog has the slot. The parameter schema is defined. The execution surface is mapped. When the implementation arrives, it will be registered exactly like every other capability — named, described, parameterized, tested, and governed.
>
> The system grows. The catalog expands. The machine becomes more capable with every specification written and every implementation registered. And the architecture ensures that growth does not produce chaos.
>
> The system grows. The complexity doesn't. That is the design constraint. That is why the catalog exists. And that is why extensibility — not horsepower, not model size, not the latest framework — is the solopreneur's ultimate competitive advantage.
