# Studio, Media, Assets, And Content Production

## UX Intent

Studio is where Ordo produces and organizes work:

- media
- content
- workflow runs
- reusable files
- drafts
- QA outputs
- public/private publish or share decisions

Studio should feel like a production room, not a file browser or queue viewer.

## Existing Code Evidence

Studio:

- `src/components/studio/StudioWorkspace.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/app/studio/page.tsx`
- `src/app/studio/media/[assetId]/page.tsx`
- `src/app/studio/workflows/[workflowId]/page.tsx`

Media:

- `src/core/capability-catalog/families/media-capabilities.ts`
- `src/core/use-cases/tools/generate-chart.tool.ts`
- `src/core/use-cases/tools/generate-graph.tool.ts`
- `src/core/use-cases/tools/generate-audio.tool.ts`
- `src/core/use-cases/tools/compose-media.tool.ts`
- `src/lib/media/**`
- `src/lib/audio/audio-generation-service.ts`
- `src/lib/graphs/**`
- `src/components/media/**`
- `src/components/AudioPlayer.tsx`
- `src/components/GraphRenderer.tsx`

Content:

- `src/core/capability-catalog/families/blog-capabilities.ts`
- `src/core/use-cases/tools/blog-production.tool.ts`
- `src/core/use-cases/tools/journal-write.tool.ts`
- `src/core/use-cases/tools/journal-query.tool.ts`
- `src/lib/blog/**`
- `src/lib/journal/**`
- `src/app/blog/**`
- `src/app/journal/**`
- `src/app/feed/page.tsx`
- `src/app/feed/[slug]/page.tsx`
- `src/lib/content/content-campaign-read-model.ts`

Data:

- `user_files`
- `media_workflows`
- `media_workflow_steps`
- `media_workflow_events`
- `blog_posts`
- `blog_assets`
- `blog_post_revisions`
- `blog_post_artifacts`
- `materialization_records`

Tests:

- `src/components/studio/StudioWorkspace.test.tsx`
- `src/lib/studio/load-studio-workspace.test.ts`
- `src/lib/media/**.test.ts`
- `src/lib/audio/audio-generation-service.test.ts`
- `src/lib/graphs/**.test.ts`
- `src/core/use-cases/tools/*media*.test.ts`
- `src/core/use-cases/tools/journal-write.tool.test.ts`
- `src/lib/blog/blog-production-root.test.ts`
- `src/app/studio/**.test.tsx`
- `src/lib/content/content-campaign-read-model.test.ts`
- `src/app/feed/[slug]/page.test.tsx`

## Current Functionality

Studio already projects:

- media workflow cards
- standalone job cards
- user file/media cards
- status counts and filters
- search/pagination patterns

Media system can:

- generate charts
- generate graphs
- generate audio
- compose media/video from governed asset IDs
- route FFmpeg execution through browser or server paths
- rehydrate composition sources
- burn captions
- handle SVG/mermaid/rasterization support
- estimate subtitles and duration
- store user media/files with hashes and metadata

Content system can:

- draft content
- publish content
- project published content into the public Feed
- render public feed item detail pages without owner provenance or metrics
- compose blog articles
- QA blog articles
- resolve QA findings
- generate blog image prompts
- generate/select hero images
- manage journal drafts/revisions/admin review
- project owner content into Studio cards and content detail lenses
- group content, public offers, and tracked links into a content-performance
  campaign read model

## UX Mapping

| Existing system | UX object | Surface |
| --- | --- | --- |
| `user_files` | Media / file asset | Studio |
| `media_workflows` | Workflow run | Studio |
| `blog_posts` | Content item | Studio/Feed |
| `blog_assets` | Media asset | Studio/Content detail |
| `blog_post_revisions` | Revision history | Content provenance |
| `materialization_records` | Provenance evidence | Detail lens |
| `compose_media` | Media production run | Studio |
| `qa_blog_article` | QA loop | Content detail |
| `tracked_links` / `tracked_link_events` | Content performance evidence | Studio/Business detail |

## Product Requirements

1. Studio cards must distinguish media, content, workflow runs, and drafts.
2. Public content and private content must be visibly different.
3. Published public content can appear in Feed.
4. Private content should remain in Studio/People or a role-gated surface.
5. Media assets should link to their source run/provenance.
6. Generated content should link to QA, revision, source, and publishing state.
7. Content and media should be reusable in future workflows.
8. The user should be able to review, publish, keep private, download, or share
   from obvious card/detail actions.

## Gaps

- Feed is connected to published articles first; audio episodes, shorts, and
  private feed variants remain follow-on work.
- Private content sharing is not first class.
- Blog/journal is still admin-shaped in places.
- Asset library behavior exists, but the product should lead with Studio
  objects instead of "Library."
- A general QA loop exists in donors but is not a reusable UX primitive yet.
- Campaign performance is currently a read model over existing tables, not a
  durable campaign/content-pillar authoring system.

## Tests To Preserve Or Add

Existing:

- media composition planning/execution/preflight
- audio generation service
- graph/chart payloads and rendering
- media workflow orchestration/read model
- Studio projection tests
- journal write/query and blog production tests

Add:

- public content appears in Feed only after publish
- draft/private content does not appear in public Feed
- content tracked links roll up real visits/chats/signups without fake metrics
- owner content and content-performance campaigns appear in Studio
- Studio card links media to source workflow and materialization record
- content QA loop preserves revisions and review state
- one generated media output can be reused in a later compose run
