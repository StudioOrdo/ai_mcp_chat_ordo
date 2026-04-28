# Feature Spec: My Media Route

**Status:** Draft Spec — Ready for Execution
**Priority:** Phase 1 (low-risk, high user value)
**Execution Surface:** Next.js app route + user file repository + governed file API
**Dependencies:** `UserFileRepository`, `UserFileDataMapper`, `UserFileSystem`, `/api/user-files/[id]`, auth session helpers

---

## Purpose

Give signed-in users a first-class place to browse the media the system already stores for them. Today media exists as governed files in `.data/user-files`, but it is surfaced only indirectly through chat, generated artifacts, and internal flows. The route should make uploads and generated assets visible, searchable, and reusable without forcing users to hunt through old conversations.

---

## Current State

The storage substrate is already in place:

- `user_files` records persist `file_size`, `mime_type`, `file_type`, `conversation_id`, metadata JSON, and timestamps.
- `UserFileRepository` already supports `findById`, `listByConversation`, and `listByUser`.
- `/api/chat/uploads` already records upload metadata and stores files through `UserFileSystem`.
- `/api/user-files/[id]` already serves governed files and supports byte-range playback, which is enough for browser media preview.

The missing piece is product surface, not storage.

---

## Recommended Route

Use a user-facing route:

`/my/media`

This keeps the route semantically clear and distinct from admin surfaces.

---

## Target Experience

The route should provide:

1. A paged gallery or table of the current user's stored assets.
2. Filters for file type, source, retention class, and conversation attachment state.
3. Inline preview for image, audio, and video assets using `/api/user-files/[id]`.
4. A metadata panel showing filename, size, created date, duration, dimensions, and source.
5. A link back to the owning conversation when `conversationId` is present.
6. A delete action for unattached ephemeral assets only in v1.

The route is a retrieval and organization feature first. It is not a new editor.

---

## Information Architecture

### Primary sections

| Section | Purpose |
| --- | --- |
| Summary strip | Show total asset count, total storage used, and recent uploads |
| Filter bar | Filter by type, source, retention class, attached vs unattached |
| Media list | Grid for visual media, compact list for documents and subtitles |
| Detail drawer | Rich metadata, preview, and conversation linkage |

### Initial filters

| Filter | Values |
| --- | --- |
| Type | all, image, video, audio, document, chart, waveform, subtitle |
| Source | all, upload, browser-generated, worker-generated |
| Retention | all, ephemeral, conversation, durable |
| Attachment state | all, attached, unattached |

---

## Implementation

### 1. Add a user media query surface

The existing repository can already list per-user files, but the route needs filtering and pagination. Extend the repository contract with a purpose-built user listing method rather than pulling all rows into memory.

Recommended additions to `UserFileRepository`:

```ts
listForUser(userId: string, options: {
  fileType?: UserFile["fileType"];
  source?: UserFile["metadata"]["source"];
  retentionClass?: UserFile["metadata"]["retentionClass"];
  attached?: boolean;
  limit: number;
  cursor?: string;
}): Promise<{ items: UserFile[]; nextCursor: string | null }>;

getUserStorageSummary(userId: string): Promise<{
  totalFiles: number;
  totalBytes: number;
  images: number;
  videos: number;
  audio: number;
  documents: number;
}>;
```

The current `listByUser` method is fine for internal use, but it is too blunt for a production UI.

### 2. Add route-level view model loader

Create a server-side loader that:

- resolves the current authenticated user,
- validates query-string filters,
- fetches the filtered page of assets,
- fetches the storage summary,
- returns a UI-ready model.

This should stay server-rendered so previews and counts are indexable inside the app shell and do not depend on client hydration for basic usability.

### 3. Reuse governed delivery

Do not create a second file-serving path. All previews and downloads should continue to use `/api/user-files/[id]` so access control and range playback remain centralized.

### 4. Add safe deletion rules

For v1, allow deletion only when:

- the asset belongs to the current user,
- the asset is unattached to a conversation,
- the asset is not referenced as a derivative source.

Attached conversation assets should be read-only until the data lifecycle policy is expanded deliberately.

### 5. Link back to source context

When `conversationId` exists, expose a "View conversation" link. This is the main reason the route becomes more than a file bucket: it preserves narrative context.

---

## Non-Goals

- Admin-wide browsing of all users' media.
- Cross-user sharing.
- Bulk deletion of conversation-attached files.
- Album, folder, or collection modeling.
- Asset editing, trimming, or recomposition.

---

## Acceptance Criteria

1. Authenticated users can open `/my/media` and see only their own assets.
2. The route displays correct total file count and total bytes from persisted `user_files` records.
3. Image, audio, and video assets preview successfully using existing `/api/user-files/[id]` delivery.
4. Filtering by file type and retention class changes both the item list and result count correctly.
5. Unattached assets can be deleted by their owner; attached assets cannot be deleted from this route.
6. A user cannot access another user's asset detail or preview through this route.

---

## Validation

- Add server tests for filter parsing and storage summary mapping.
- Add repository tests for `listForUser` pagination and filtering.
- Add a Playwright route test covering preview, filter, and delete of an unattached asset.
- Verify that direct asset playback still uses `/api/user-files/[id]` and respects access control.

---

## Rollout Notes

This is the cleanest first deliverable because the data already exists and the permission model is straightforward. It should ship before any operator-facing media console.

---

*Spec drafted by GitHub Copilot. Grounded in the current `user_files` storage and route architecture.*
