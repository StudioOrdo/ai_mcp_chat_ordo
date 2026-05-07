# Provider Capability Configuration Systemic Audit

This audit lists surfaces that can drift when provider configuration changes.
It is historical baseline evidence for the provider-capability package; phase
closeout status is tracked in `validation-checklist.md` and the individual
phase documents.

## Provider Config Surfaces

| Surface | Original concern | Target |
| --- | --- | --- |
| `src/lib/config/env.ts` | Env-only provider truth and hard-coded fallbacks. | Compatibility wrappers over provider config resolver. |
| `src/lib/config/ConfigurationService.ts` | Useful env-then-SQLite primitive. | Retain as low-level storage resolver. |
| `src/lib/config/env-config.ts` | Missing new provider/capability env schema fields. | Add provider/capability keys. |
| `compose.yaml` | Defaults Anthropic model directly. | Align with provider catalog defaults or document override. |
| `README.md` | Presents Anthropic/OpenAI env setup without capability distinction. | Explain intelligence vs optional capability providers. |

## Intelligence Runtime Surfaces

| Surface | Original concern | Target |
| --- | --- | --- |
| `src/lib/chat/stream-route-handler.ts` | Reads `getAnthropicApiKey()`. | Resolve effective provider/client. |
| `src/lib/chat/chat-turn.ts` | Instantiates Anthropic directly from env helper. | Use provider client factory. |
| `src/lib/chat/provider-policy.ts` | Model candidates come from env-only Anthropic fallbacks. | Provider-specific model candidates from resolver. |
| `src/lib/chat/conversation-root.ts` | Summarizer uses env key/fallback. | Use selected intelligence config. |
| `src/lib/blog/blog-production-root.ts` | Article model uses env key/model. | Use selected intelligence config. |

## Optional Capability Surfaces

| Surface | Provider | Original concern | Target |
| --- | --- | --- | --- |
| `generate_audio` | OpenAI TTS | Registered even if OpenAI missing. | Pruned unless TTS available. |
| `/api/tts` | OpenAI TTS | Direct route has key guard but no provider-disabled concept. | Disabled/missing-provider response. |
| `generate_blog_image` | OpenAI image | Lazy failure if missing key. | Pruned unless image generation available. |
| `admin_web_search` | OpenAI web search | Registered even if OpenAI missing. | Pruned unless web search available. |
| `mcp/admin-web-search-server.ts` | OpenAI web search | Sidecar creates deps from env helper. | Shared provider/capability config. |
| `mcp/generate-audio-server.ts` | OpenAI TTS | Sidecar calls audio service directly. | Shared provider/capability config. |

## Tool Registry Surfaces

| Surface | Original concern | Target |
| --- | --- | --- |
| `config/tools.json` | Static file can enable/disable tools but is not a runtime admin surface. | Retain as operator override layer in the effective tool policy. |
| `src/lib/config/instance.ts` | File-backed instance config is process-cached. | Runtime tool settings should not depend on restarting to take effect. |
| `src/lib/chat/tool-composition-root.ts` | Static `tools.json` pruning only and process-cached registry. | Effective tool policy with install profile, static override, SQLite admin override, provider availability, role, and request layers. |
| `src/lib/chat/tool-capability-routing.ts` | Request filtering assumes registered tools are executable. | Continue request filtering after availability pruning. |
| `src/lib/chat/runtime-manifest.ts` | Counts unavailable tools if registered. | Counts only available tools. |
| `src/core/entities/role-directive-assembler.ts` | Prompt hints come from the full catalog, not effective availability. | Prompt hints should only describe tools present in the effective manifest. |
| Capability catalog | Static capability truth. | Retain; availability is runtime projection, not catalog mutation. |

## Tool Control Plane Surfaces

| Surface | Original concern | Target |
| --- | --- | --- |
| Theme tools | Best provider-free basic tool proof, but not explicitly protected. | Default-on and protected from normal disablement. |
| Admin tool settings | No screen exists. | `/admin/system/tools` lists effective state and reason codes. |
| Conversational tool toggles | No admin tool exists. | `configure_tool_availability` can explain, enable, and disable toggleable tools/bundles. |
| Protected recovery tools | No policy exists. | `inspect_runtime_context`, `inspect_runtime_logs`, `inspect_theme`, `set_theme`, `adjust_ui`, and future `configure_tool_availability` remain recoverable. |

## Admin And Health Surfaces

| Surface | Original concern | Target |
| --- | --- | --- |
| `src/app/admin/system/page.tsx` | Raw env display. | Effective config display with source and redaction. |
| `src/app/admin/system/keys/KeysManager.tsx` | Key-only UI. | Provider settings UI. |
| `src/lib/admin/processes.ts` | Env-only OpenAI/Anthropic diagnostics. | Capability-aware diagnostics. |
| `src/lib/health/probes.ts` | Chat readiness tied to Anthropic env helper. | Intelligence provider readiness plus optional capability status. |

## Future Handoff

Local Whisper/STT should not be implemented in this refactor beyond reserving
the provider contract and UI slot. A later speech package should implement:

- `transcribe_audio` capability
- `/api/stt`
- local `whisper.cpp` or Transformers.js provider
- hardware/device probe reporting
