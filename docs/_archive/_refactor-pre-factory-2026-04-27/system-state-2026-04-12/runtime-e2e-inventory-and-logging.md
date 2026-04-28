# Runtime E2E Inventory And Logging

Date: 2026-04-14

## Why This Exists

The bad deferred publishing run at the end of `convo2.txt` is not a UI-only problem. The export shows repeated `produce_blog_article` replays tied back to the same original job lineage, with the latest replay still running in `resolve_blog_article_qa` instead of reaching a clean terminal state. That is exactly the class of failure that needs both:

- live end-to-end execution against real dependencies
- durable runtime logs outside the chat transcript and DB event projection

## Immediate Logging Baseline

Server-owned runtime execution now has a best-effort JSONL audit log at:

- `.runtime-logs/deferred_job.jsonl`
- `.runtime-logs/native_process.jsonl`
- `.runtime-logs/remote_service.jsonl`
- `.runtime-logs/mcp_process.jsonl`

The directory can be overridden with `ORDO_RUNTIME_AUDIT_LOG_DIR`.

The canonical operator-facing way to resolve the active path is now `npm run admin:diagnostics`, which includes the resolved runtime-audit directory plus the concrete JSONL file paths for each server-owned runtime category.

This is not a replacement for structured app logs or persisted job events. It is a debugging bridge so failed replay, MCP, native-process, and remote-service runs leave durable file traces that can be inspected even when the chat transcript is incomplete or noisy.

## Inventory By Execution Environment

| Execution environment | First intensive live E2E candidate | Why this candidate matters | Minimum evidence to capture |
| --- | --- | --- | --- |
| `host_ts` | `list_conversation_media_assets` on a conversation that already contains governed media artifacts | Validates canonical asset rediscovery after import/replay and confirms host-owned artifact governance still works without depending on message-part-only continuity | returned asset list, governed asset ids, conversation id, any import/replay provenance used to seed the run |
| `deferred_job` | `produce_blog_article` with real publishing inputs and full QA/approval path | This is the currently failing operational class. It exercises retries, replay lineage, progress projection, and terminal notification behavior | job id lineage, replay source id, full phase progression, retry scheduling, terminal state, `.runtime-logs/deferred_job.jsonl` |
| `browser_wasm` | `compose_media` forced down the browser FFmpeg route with real user assets | This is the heaviest live client-side runtime. It validates COOP/COEP, browser worker execution, asset continuity, and fallback boundaries | browser console logs, worker error output, generated asset metadata, route decision, client capability probe result |
| `mcp_stdio` | `admin_web_search` or equivalent admin-intelligence MCP-backed search path against real provider credentials | Exercises managed stdio MCP execution and tool-call failure surfaces without requiring the container pilot | tool input, MCP target id, stderr on failure, tool result envelope, `.runtime-logs/mcp_process.jsonl` |
| `mcp_container` | the compose-backed admin-intelligence sidecar path for a real MCP tool | Validates container health, host-to-container invocation, and parity with the stdio-managed path | compose service health, target id, tool result, stderr on failure, `.runtime-logs/mcp_process.jsonl`, container logs |
| `native_process` | `compose_media` through the planner-declared local native-process target | This is the first real non-host media runtime pilot and the cleanest way to validate external execution without changing governance | process id, argv, plan summary, output artifact metadata, `.runtime-logs/native_process.jsonl` |
| `remote_service` | `generate_audio` as the next production-promotion candidate | This is the clearest next externalized media workload and should be proven with real networked provider behavior before broader promotion | request shape, provider response shape, governed output artifact metadata, latency, `.runtime-logs/remote_service.jsonl` |

## Recommended Order

1. `produce_blog_article` in `deferred_job`
2. `compose_media` in `native_process`
3. `admin_web_search` in `mcp_stdio`
4. container-backed MCP parity run in `mcp_container`
5. `generate_audio` in `remote_service`
6. `compose_media` in `browser_wasm`
7. `list_conversation_media_assets` in `host_ts`

This order is intentional. It starts with the currently failing production behavior, then covers the next runtime-promotion seams, then closes with the host-only verification path.

## What The New File Logs Cover

Current file-backed runtime audit coverage is server-side only:

- `deferred_job`: lease recovery, start, progress, retry scheduling, cancel detection, success, failure
- `native_process`: invocation start, success, failure
- `remote_service`: invocation start, success, failure
- `mcp_process`: session init, tool call start, tool call success, tool call failure, session close

## Known Gap

`browser_wasm` still does not write into the server-side JSONL audit files, because the browser worker runs outside the server process. For that environment, we still need a follow-up diagnostic path that captures worker/runtime logs and attaches them to a server-owned artifact or debug endpoint.

## Minimum Exit Criteria For Intensive E2E

Each runtime-specific E2E should be considered incomplete unless it records all of the following:

- the execution environment actually selected at runtime
- the stable job id or invocation id
- the governed artifact ids created or reused
- the terminal result or terminal failure class
- the corresponding runtime audit log file entries when the environment is server-owned
