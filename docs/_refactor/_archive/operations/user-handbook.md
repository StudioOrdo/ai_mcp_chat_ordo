# User Handbook

This handbook explains how to use Studio Ordo as an end user, contributor, or operator. It covers the main product features, the role system, setup instructions, the internal chat tools, and the standalone MCP servers shipped with the repository.

## 1. Who This Is For

This guide is useful for:

- new developers trying to run the repo locally
- operators who need to understand roles, prompts, and tools
- instructors or students using the repo as a teaching system
- admins managing corpus, prompts, analytics, and content workflows

## 2. What Studio Ordo Is

Studio Ordo is a chat-first advisory and training system. A user can arrive anonymously, sign in, search the corpus, ask implementation questions, recover prior conversation context, and move toward consultation, deal, or training-path workflows. Internal users and admins get a wider tool surface for analytics, content operations, and prompt management.

## 3. Getting Started

### Local setup

```bash
npm install
cp .env.example .env.local
npm run validate:env
npm run dev
```

Then open `http://localhost:3000`.

### Minimum environment

- `ANTHROPIC_API_KEY` is required for core chat

### Recommended environment values

- `ANTHROPIC_MODEL=claude-haiku-4-5`
- `ANTHROPIC_REQUEST_TIMEOUT_MS=10000`
- `ANTHROPIC_RETRY_ATTEMPTS=2`
- `ANTHROPIC_RETRY_DELAY_MS=150`

### Optional environment

- `OPENAI_API_KEY` enables admin web search and related OpenAI-backed flows

### Useful commands

```bash
npm run dev
npm run test
npm run quality
npm run build
npm run admin:health
npm run admin:diagnostics
```

## 4. Main Product Areas

### Homepage chat

Route: `/`

The homepage is the primary interface. Users describe a workflow problem, implementation gap, training goal, or handoff issue. The system responds with role-aware guidance, tool usage, links, and suggested next steps.

### Library

Routes:

- `/library`
- `/library/[document]`
- `/library/[document]/[section]`

The library exposes the corpus as documents and sections. It supports direct reading and also acts as the knowledge base behind corpus-grounded chat answers.

### Blog

Routes:

- `/blog`
- `/blog/[slug]`

The blog shows published posts. Admin users can work with draft and publish tools through the application tool layer.

### Authentication

Routes:

- `/login`
- `/register`
- `/profile`

Anonymous users can use the system in demo mode. Signed-in users get broader tool access and continuity features such as preference persistence and conversation-history search.

### Workflow records

Internal and semi-user-facing APIs support:

- consultation requests
- deal records
- training paths
- conversation-linked workflow state

These flows are especially relevant for staff and admin usage.

## 5. Role System

Studio Ordo uses five roles.

| Role | What it means |
| --- | --- |
| `ANONYMOUS` | visitor without an authenticated session |
| `AUTHENTICATED` | signed-in customer or practitioner |
| `APPRENTICE` | student/apprentice experience with learning-oriented framing |
| `STAFF` | internal staff mode |
| `ADMIN` | full operator/admin mode |

### Role behavior summary

- `ANONYMOUS` gets limited but useful chat and corpus access
- `AUTHENTICATED`, `APPRENTICE`, and `STAFF` share the main member tool set but differ in prompt framing
- `ADMIN` gets the full member set plus operator, analytics, web search, and content management tools

### Session behavior

- the app defaults to `ANONYMOUS` when no valid session exists
- a validated real session can be overlaid with a mock role cookie for simulation/testing workflows
- role checks are enforced server-side, not just in the UI

## 6. Internal Chat Tool Guide

These tools are exposed to the chat model through the internal `ToolRegistry`.

### Tools available to all roles

| Tool | What it does |
| --- | --- |
| `calculator` | performs arithmetic and is required for math operations |
| `search_corpus` | searches the corpus/library |
| `get_corpus_summary` | returns corpus-wide summary information |
| `set_theme` | changes the site theme |
| `inspect_theme` | reports the manifest-backed theme profiles and approved control axes without mutating state |
| `adjust_ui` | adjusts density or UI preferences |
| `navigate` | navigates the user to a route |

### Additional member tools for `AUTHENTICATED`, `APPRENTICE`, `STAFF`, and `ADMIN`

| Tool | What it does |
| --- | --- |
| `get_section` | retrieves a full corpus section |
| `get_checklist` | returns actionable checklists from corpus material |
| `list_practitioners` | lists key practitioners referenced in the corpus |
| `generate_audio` | generates an in-chat audio player |
| `generate_chart` | generates a Mermaid diagram |
| `generate_graph` | generates a quantitative graph or data table for trends, comparisons, distributions, and operational summaries |
| `search_my_conversations` | searches the user’s own prior conversations |
| `set_preference` | persists preferences such as tone or response style |

Use `generate_chart` for Mermaid diagrams such as workflows, flowcharts, or mindmaps. Use `generate_graph` when the request is analytical: values over time, grouped comparisons, distributions, outliers, heatmaps, or a custom plotted view of structured data.

### Additional admin-only tools

| Tool | What it does |
| --- | --- |
| `admin_web_search` | runs sourced live web search |
| `admin_prioritize_leads` | ranks leads needing founder/admin attention |
| `admin_prioritize_offer` | chooses the next offer/message to push |
| `admin_triage_routing_risk` | surfaces conversations with routing or follow-up risk |
| `draft_content` | drafts blog/content records |
| `publish_content` | publishes drafted content |

## 7. MCP Tool Catalog

The repo ships two standalone MCP servers.

Shared capability modules now live under `src/lib/capabilities/shared/`. Those modules are part of the application runtime and are imported both by the app and by MCP server entrypoints; they are not separate remote MCP endpoints in the current deployment model.

### Calculator MCP server

Command:

```bash
npm run mcp:calculator
```

Tools:

| Tool | Purpose |
| --- | --- |
| `calculator` | add, subtract, multiply, or divide two numbers |

### Operations MCP server

Command:

```bash
npm run mcp:operations
```

This server groups four categories of tools.

#### A. Embeddings and search tools

| Tool | Purpose |
| --- | --- |
| `embed_text` | embed arbitrary text and return dimensions plus a preview |
| `embed_document` | chunk, embed, and store a document in the vector store |
| `search_similar` | run hybrid similarity search using BM25, vectors, and RRF |
| `rebuild_index` | rebuild embeddings/indexes for a source type |
| `get_index_stats` | inspect embedding counts, BM25 stats, and embedder readiness |
| `delete_embeddings` | remove embeddings for a specific source ID |

#### B. Corpus librarian tools

| Tool | Purpose |
| --- | --- |
| `corpus_list` | list all corpus documents with section counts and indexing status |
| `corpus_get` | fetch one document and its sections |
| `corpus_add_document` | add a new document directly or from a base64 zip archive |
| `corpus_add_section` | add a section to an existing document |
| `corpus_remove_document` | remove a document and its embeddings |
| `corpus_remove_section` | remove a section and its embeddings |

#### C. Prompt management tools

| Tool | Purpose |
| --- | --- |
| `prompt_list` | list stored prompt versions by role and prompt type |
| `prompt_get` | fetch the active or a specific prompt version |
| `prompt_set` | create and activate a new prompt version |
| `prompt_rollback` | reactivate an older prompt version |
| `prompt_diff` | diff two prompt versions line by line |
| `prompt_get_provenance` | inspect the last stored prompt provenance for a conversation |

#### D. Analytics tools

| Tool | Purpose |
| --- | --- |
| `conversation_analytics` | aggregate overview, funnel, engagement, tool usage, drop-off, or routing-review analytics |
| `conversation_inspect` | inspect one conversation or recent conversations for a user |
| `conversation_cohort` | compare anonymous, authenticated, and converted cohorts |

## 8. Setup And Operations

### Search index and retrieval

The build step runs `npm run build:search-index` before `next build`. If you modify corpus content or need to force a rebuild, use:

```bash
npm run build:search-index
npm run build:search-index:force
```

### Quality and verification

Use these as the default verification ladder:

```bash
npm run typecheck
npm run lint:strict
npm run test
npm run quality
```

For browser-facing behavior:

```bash
npm run browser:verify
npm run browser:smoke
```

### Operational checks

```bash
npm run validate:env
npm run admin:validate-env
npm run admin:health
npm run admin:diagnostics
npm run parity:env
npm run scan:secrets
```

### Release evidence and governance

```bash
npm run runtime:inventory
npm run qa:runtime-integrity
npm run release:evidence
```

Run `npm run qa:runtime-integrity` before `npm run release:evidence` so the
aggregate release report has fresh integrity evidence to consume.

See [release-gates-and-evidence.md](release-gates-and-evidence.md) for the full
release ladder, current artifact outputs, and public-governance rules.

## 9. Common Workflows

### For a new user

1. Open `/`
2. Ask a workflow or implementation question
3. Use suggested follow-up prompts or action links
4. Register if you want persistent access and broader tool support

### For a signed-in member

1. Sign in through `/login`
2. Use chat normally
3. Save preferences implicitly through conversations when appropriate
4. Ask the system to recall earlier discussions using conversation search

### For an admin/operator

1. Use admin role context
2. Run chat workflows that invoke admin tools for search, lead prioritization, offer prioritization, routing risk, or content operations
3. Use MCP prompt tools to inspect or version prompts
4. Use MCP analytics tools to inspect the funnel and conversation cohorts

### For corpus maintenance

1. Start `npm run mcp:operations`
2. Use `corpus_list` and `corpus_get` to inspect current state
3. Add or remove documents/sections with the librarian tools
4. Rebuild embeddings/indexes when needed

## 10. Important Notes And Constraints

- prompt-visible tool access is role-scoped and derived from the registry
- role simulation is an overlay for testing, not an independent auth mechanism
- corpus management and prompt management are operational/admin capabilities, not general end-user features
- admin web search requires `OPENAI_API_KEY`
- the profile page currently exists as a placeholder rather than a completed profile management experience

## 11. Where To Go Next

- architecture overview: [system-architecture.md](system-architecture.md)
- visual diagrams: [architecture-diagrams.md](architecture-diagrams.md)
- operational commands: [admin-runbook.md](admin-runbook.md)
- environment rules: [environment-matrix.md](environment-matrix.md)
- release verification: [release-gates-and-evidence.md](release-gates-and-evidence.md)
- feature specs and sprint docs: [../_specs/README.md](../_specs/README.md)
