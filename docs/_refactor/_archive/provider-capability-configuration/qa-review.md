# Provider Capability Configuration QA Review

## Findings To Fix

### 1. Install/admin validation hard-codes deprecated model behavior

Code anchors:

- `src/app/api/install/validate-keys/route.ts`
- `src/app/api/admin/system/keys/route.ts`

Risk:

- A valid key can fail install because the validation model is unavailable.
- Runtime model policy can differ from install/admin validation.

Required fix:

- Validate the selected provider/model pair through a shared validation service.

### 2. Runtime config bypasses SQLite settings

Code anchors:

- `src/lib/config/env.ts`
- `src/lib/chat/provider-policy.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/chat-turn.ts`
- `src/lib/chat/conversation-root.ts`
- `src/lib/blog/blog-production-root.ts`

Risk:

- Install writes provider settings to SQLite, but runtime chat can still require
  env-only config.

Required fix:

- Provider runtime callers must use the effective config resolver.

### 3. Admin health shows raw env instead of effective config

Code anchors:

- `src/app/admin/system/page.tsx`
- `src/lib/admin/processes.ts`
- `src/lib/health/probes.ts`

Risk:

- Admin UI can report provider settings missing even when SQLite config works,
  or vice versa.

Required fix:

- Health/admin pages must display effective config and source.

### 4. OpenAI-backed tools are offered when unavailable

Code anchors:

- `src/lib/chat/tool-composition-root.ts`
- `src/core/capability-catalog/families/media-capabilities.ts`
- `src/core/capability-catalog/families/blog-capabilities.ts`
- `src/core/capability-catalog/families/admin-capabilities.ts`

Risk:

- The model can call tools that cannot execute because optional provider config
  is absent.

Required fix:

- Add the general runtime tool control plane first, then feed provider-backed
  capability availability into that policy before prompt/tool registration.

### 5. Tool configuration is static-only and prompt hints can drift

Code anchors:

- `config/tools.json`
- `src/lib/config/instance.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/core/entities/role-directive-assembler.ts`

Risk:

- Admins cannot turn tools on/off at runtime.
- Static config changes require cache reset/restart.
- Disabled tools can remain described in role prompt hints.

Required fix:

- Add SQLite-backed runtime tool settings, an admin tool settings screen, and an
  admin-only conversational tool for toggleable tools/bundles.
- Make prompt-hint assembly consume the effective tool policy.

### 6. OpenAI role is product-ambiguous

Code anchors:

- `src/app/install/InstallWizard.tsx`
- `src/app/admin/system/keys/KeysManager.tsx`
- `README.md`
- `compose.yaml`

Risk:

- Operators may believe OpenAI is required for chat or that OpenAI is the main
  intelligence provider.

Required fix:

- UI/docs must label OpenAI as optional image/audio/web-search capability
  provider.

## Design Guardrails

- Keep `ConfigurationService`; it is the correct low-level key/value resolver.
- Keep `ProviderRuntime`; the retry/fallback runner already exists.
- Do not put provider-specific SDK calls in UI routes.
- Do not put capability availability logic inside React components.
- Do not make static `tools.json` carry dynamic provider availability.
- Do not make provider pruning bypass the general runtime tool policy.
- Do not let normal admin controls disable protected recovery/basic tools.
- Add route/worker guards even after registry pruning.
