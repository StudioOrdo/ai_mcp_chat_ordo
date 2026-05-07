# Keith Compose Video Duplicate - Five Whys

Date: 2026-04-30
Status: investigation complete; fix not implemented in this note

## Scope

This note covers the current `keith@firehose360.com` conversation where a
queued/broken-looking video card appeared quickly, then a later video card
worked. This is related to the chat job event delivery refactor, but it is not
the same failure as the original repeated web-search status cards.

## Evidence

Current local records:

- User: `keith@firehose360.com`
- User ID: `usr_a3a9341d-de18-4e2f-ba7b-fc244414121f`
- Conversation ID: `conv_837e0675-bde1-4db8-a433-5a65e4cf2f95`
- Compose job: `job_303abe81-42d4-4e63-8afb-3ee9481e8627`
- Output asset: `uf_e80d2b44-d8a7-4697-8bd2-b798c5017f8b`
- Output file: `.data/user-files/usr_a3a9341d-de18-4e2f-ba7b-fc244414121f/89b22f58bccea1cd5b5ac0079a58cc4f.mp4`
- File check: valid ISO Media MP4, 1.7 MB
- Materialization record:
  `mat_job_job_303abe81-42d4-4e63-8afb-3ee9481e8627`

Durable job truth has one compose job and one ready materialized output for the
semantic plan. The duplicate symptom is therefore presentation/state projection,
not two durable compose jobs.

Two transcript surfaces are involved:

1. `msg_0030b686-7c1a-4810-a5f4-d331dd8d91f9`
   - Assistant text says: `Rendering in progress` and `The job is queued`.
   - Contains the `compose_media` tool result with `deferred_job.status = queued`.
   - Contains a queued `job_status` part at sequence `13`.
   - Its `resultEnvelope` has `cardKind: "media_render"`, no replay snapshot,
     and no artifacts. The media card therefore renders the dark `Processing...`
     placeholder. It cannot play because there is no video artifact in that
     payload.

2. `msg_e08149d9-7e4a-4b2c-862d-fc49ce1791db`
   - Contains the succeeded `job_status` part at sequence `28`.
   - Its `resultEnvelope.artifacts` includes the playable video asset
     `uf_e80d2b44-d8a7-4697-8bd2-b798c5017f8b`.

## Five Whys

1. Why did the user see a broken video and then a working video?
   - The first surface was not a real video output. It was a queued
     `compose_media` media-render card with no artifacts, so `MediaRenderCard`
     showed a processing placeholder. The second surface was the succeeded
     durable job card with the real MP4 artifact.

2. Why did the queued placeholder remain as a video-facing card after the real
   job completed?
   - The queued state was stored inside the assistant transcript message as both
     a `tool_result.deferred_job` snapshot and an explicit queued `job_status`
     part. The completed state arrived through the durable job event path as a
     separate job-status message instead of rewriting the original queued
     transcript surface in place.

3. Why did the current dedupe work not collapse those into one final card?
   - The recent work focused on durable job events, status-tool polling spam,
     and `jobId` freshness in presenter candidates. This compose case crosses a
     different boundary: a queued tool-result media card with no artifact sits
     inside a contentful assistant message, while the completed job card arrives
     as durable job truth. The earlier tests cover repeated status-tool
     snapshots and explicit job-status parts, but not a contentful assistant
     message whose stale nested `compose_media` deferred-job payload still
     renders a `media_render` placeholder.

4. Why is there still a stale/latest mismatch in the presentation path?
   - `suppressStaleJobStatusMessages()` determines the latest explicit
     `job_status` message by transcript order, not by `sequence`, `updatedAt`,
     terminal state, or the shared `JobRenderCandidateMerger` freshness rules.
     In this conversation the final durable job message was created before the
     assistant's explanatory queued message, so order-based suppression can
     preserve the later queued transcript part even though the durable sequence
     says the job succeeded. Separately, the queued `tool_result` can still be
     interpreted as a nested job snapshot unless presenter-level freshness is
     applied across this exact mixed explicit/nested/contentful case.

5. Why did our package not already resolve this, even though it was the point of
   the refactor?
   - The package solved the first job-spam class: assistant status polling and
     repeated unchanged status snapshots. It prepared, but did not implement,
     the Phase 08 legacy fragmentation cleanup that specifically calls out
     browser/runtime/media truth fragmentation. The deeper compose-media issue
     is already documented as a separate execution ownership problem in
     `docs/_refactor/compose-media-execution-ownership/contract-spec.md`: chat
     transcript parts are still acting as render history and runtime/job state,
     while canonical durable job/materialization state is separate.

## Root Cause

The chat surface still allows a stale `compose_media` transcript payload to
render as a media output candidate after canonical durable job truth has already
produced the real video.

More specifically, the current projection path has two gaps:

- Stale explicit job-status suppression uses transcript order instead of job
  freshness semantics.
- Stale nested `compose_media` tool-result snapshots with no artifact are not
  suppressed against newer canonical job/materialization truth in this mixed
  contentful-message case.

## Why The Video Itself Worked

The final output was healthy. `user_files` contains one ready video asset,
`uf_e80d2b44-d8a7-4697-8bd2-b798c5017f8b`, and the file is a valid MP4. The
broken first card was a stale/queued render placeholder, not a corrupt video
file.

## Required Fix Direction

The next implementation should treat this as Phase 08 cleanup plus
compose-media ownership alignment, not as a new transport problem:

1. Make `suppressStaleJobStatusMessages()` choose the latest job part using the
   shared freshness semantics, not transcript order.
2. Add a regression fixture matching Keith's current compose conversation:
   a contentful assistant message with queued `compose_media` tool result and
   queued `job_status`, plus a newer succeeded durable job-status part for the
   same `jobId`.
3. Ensure `ChatPresenter.presentMany()` suppresses stale nested
   `tool_result.deferred_job` snapshots when a newer canonical job part exists,
   even if the stale message has user-visible explanatory text/actions that
   should remain.
4. For `compose_media`, do not render a no-artifact queued `media_render` card
   as if it were a playable video output once canonical job/materialization
   truth has a terminal artifact.
5. Keep the compose-media execution ownership package as the broader fix for
   transcript-as-executor, but do not wait on that package to stop stale queued
   transcript payloads from duplicating final video output in chat.

## Suggested Regression Tests

- `ConversationMessages`: stale duplicate job-status suppression chooses by
  sequence/freshness rather than array order.
- `ChatPresenter.presentMany`: queued nested `compose_media` snapshot in a
  contentful assistant message is removed when a later/fresher succeeded
  canonical job-status part exists for the same `jobId`.
- `usePresentedChatMessages`: applying durable job truth to a transcript with
  Keith's queued compose message yields one visible media card, and it is the
  artifact card for `uf_e80d2b44-d8a7-4697-8bd2-b798c5017f8b`.
- `MediaRenderCard` or renderer-level coverage: queued no-artifact
  `compose_media` state is presented as progress only while it is the freshest
  state, never beside the terminal artifact state for the same job.
