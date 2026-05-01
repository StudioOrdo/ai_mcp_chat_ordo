# Workflow Opportunities And Hidden System Capabilities

## Why This Matters
The tool review should not only delete tools. The system already has deeper
capabilities that are not cleanly represented as agent workflows. The better
move is to expose product-level workflows and hide implementation-step tools.

## Common Workflows The Product Should Support

### 1. Create A Reusable Media Asset From A Conversation
User intent:
- "Make an audio summary of this."
- "Turn this answer into a short video."
- "Use the image from earlier and make a narrated clip."

Current system capability:
- `generate_audio`
- `compose_media`
- `list_conversation_media_assets`
- asset catalog projection
- media worker/runtime
- job snapshots and materialization records

Recommended agent surface:
- Keep `compose_media`, `generate_audio`, and `list_conversation_media_assets`.
- Do not expose lower-level chart/graph/media materialization details by
  default.
- Use the asset catalog as the continuity layer so generated assets are durable
  across chat, jobs, and media composer.

### 2. Recover Or Continue Work Across Sessions
User intent:
- "Pick up where we left off."
- "Show me the work in progress."
- "What files or jobs are connected to this conversation?"

Current system capability:
- `WorkspaceSnapshotReader`
- `WorkspaceRestoreReader`
- active job snapshots
- relationship memory projection
- prompt binding history
- asset catalog entries
- conversation import/export/restore routes

Recommended agent surface:
- Add or expose a product-level `restore_workspace` / `get_workspace_context`
  capability, probably intent-gated.
- Keep low-level asset/job/profile lookups internal to the workspace projection.

### 3. Manage Long-Running Work And Artifacts
User intent:
- "Is my video done?"
- "Retry the failed job."
- "Open the result from that audio job."

Current system capability:
- canonical job read model
- job event stream
- job event history
- materialization repository
- `ExecutionTimelineReader`
- job action/replay/cancel routes

Recommended agent surface:
- Collapse job query tools into `list_jobs` and `get_job_status`.
- Add explicit actions only if the agent should actually cancel/retry jobs:
  `retry_job`, `cancel_job`, or a role-scoped `manage_job`.
- Keep admin vs self scope inside the read model and policy, not separate tool
  names.

### 4. Produce A Product Or Content Package
User intent:
- "Create the full package for this offer."
- "Turn this brief into content, assets, QA, and release-ready output."
- "Revise the failed stage and continue."

Current system capability:
- `produce_product`
- `ProductBrief`
- `WorkOrder`
- `ProductionOrchestrator`
- stage executor registry
- QA checks
- revision control
- pause/resume work-order services
- execution timeline and revision projection

Recommended agent surface:
- Keep `produce_product`.
- Add `query_work_orders` and `advance_work_order` instead of exposing many
  step-level blog/journal tools.
- Use Phase 05 work-order summary read model as the visible state surface.

### 5. Convert A Conversation Into A Business Outcome
User intent:
- "This person is ready, create the next step."
- "Create a deal from this lead."
- "Create a training path from this conversation."
- "What should I do with this prospect?"

Current system capability:
- lead capture and triage
- consultation requests
- `CreateDealFromWorkflowInteractor`
- `CreateTrainingPathFromWorkflowInteractor`
- admin lead/routing review loaders
- referral lifecycle recorder
- admin operator signal loaders

Recommended agent surface:
- Expose fewer high-value workflow tools:
  - `summarize_pipeline`
  - `triage_lead`
  - `create_customer_next_step`
- Let that workflow create either a deal, training path, consultation request,
  or referral follow-up based on role and lane.
- Avoid one tool per backend record type in the default prompt.

### 6. Govern Prompts And Runtime Behavior
User intent:
- "Why did the agent answer this way?"
- "What prompt version was used?"
- "Roll this prompt back."

Current system capability:
- prompt control plane service
- prompt provenance service
- prompt MCP tools in operations sidecar
- prompt binding/provenance repositories
- execution timeline chat-turn projection, partially backed by provenance

Recommended agent surface:
- Keep this operator/admin-only.
- Consider `inspect_prompt_runtime` as an operator tool if prompt governance is
  a real product workflow.
- Do not expose prompt governance to normal users.

### 7. Storage, Quota, And Asset Hygiene
User intent:
- "What is using storage?"
- "Clean up old uploads."
- "Show reusable assets."

Current system capability:
- media storage accounting
- volume capacity checks
- user file storage summaries
- upload reaper
- media quota policy
- asset catalog reader

Recommended agent surface:
- Add `get_storage_summary` for authenticated users and admins if storage is a
  product concern.
- Add admin-only cleanup actions only after the projection is solid.
- Keep destructive cleanup behind explicit confirmation/UI, not automatic chat
  action.

### 8. Referrals And Campaigns
User intent:
- "Show my referral activity."
- "Create a referral intro."
- "Which campaigns are working?"

Current system capability:
- referral ledger
- referral analytics
- campaign presets
- referral milestone notifications
- referral QR/profile tools

Recommended agent surface:
- Keep user-facing referral summary only if referrals are core to the current
  product.
- Gate admin referral analytics outside the default prompt.
- Consider one `manage_referrals` workflow instead of four separate referral
  tools.

## Capabilities Not Cleanly Exposed As Tools
These are substantial capabilities in the system but not expressed as clean
agent-facing workflows:

| Capability Area | Current Code Surface | Current Exposure Gap |
| --- | --- | --- |
| Workspace restore/context | `WorkspaceSnapshotReader`, `/api/workspace/restore` | No clean agent tool for "resume context" |
| Work-order state | `WorkOrder`, `ProductionOrchestrator`, execution timeline | Exposed mostly through `produce_product`, not query/advance workflow tools |
| Execution timelines | `ExecutionTimelineReader`, `PlatformInteractionFacade` | Rich inspection exists, but agent only has fragmented job/status tools |
| Revision actions | `RevisionProjector`, revision route for work orders | Not a coherent agent workflow |
| Asset catalog | `AssetCatalogReader`, media/user-file projections | Only partially exposed through media asset listing |
| Storage accounting | media storage/quota modules and scripts | Not exposed as a user/admin workflow |
| Prompt governance | prompt control/provenance services and MCP tools | Admin/operator surface, not a product workflow |
| Deals/training paths | workflow interactors and routes | Not represented as high-level agent workflow tools |
| Notifications | feed/push/referral notification services | Agent cannot summarize or configure notification state cleanly |
| Lifecycle/coaching | lifecycle context, coach templates/queue | Not unified into a coaching workflow tool |

## Recommended Core Workflow Tool Set
These are product-level tools. Some may map to existing tools, others are
workflow wrappers over existing services.

Default or intent-gated user workflows:
- `search_knowledge`
- `search_my_context`
- `get_workspace_context`
- `compose_media`
- `generate_audio`
- `list_assets`
- `get_job_status`
- `list_jobs`
- `manage_profile`

Admin/operator workflows:
- `admin_search`
- `admin_web_search`
- `produce_product`
- `query_work_orders`
- `advance_work_order`
- `summarize_pipeline`
- `triage_lead`
- `create_customer_next_step`
- `inspect_execution`
- `inspect_prompt_runtime`
- `get_storage_summary`

## Key Design Principle
The agent should see workflows, not tables and internal stages.

Good agent tool:
- "Create or continue the customer next step."

Bad agent surface:
- "Choose between create deal, create training path, update lead, create
  consultation request, update founder note, update next action."

The backend can stay modular. The prompt surface should be product-shaped.

