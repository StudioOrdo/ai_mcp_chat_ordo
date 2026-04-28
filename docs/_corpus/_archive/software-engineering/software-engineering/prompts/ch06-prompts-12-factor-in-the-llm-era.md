# Prompt Companion — Chapter 6: 12-Factor in the LLM Era

> This companion document pairs with [Chapter 6](../chapters/ch06-12-factor-in-the-llm-era.md). Each prompt pair demonstrates how to apply individual 12-Factor principles to LLM-backed applications — and what goes wrong when the factor is invoked without local specificity.

---

## Prompt 1: Factor III — Config Centralization

### Bad Prompt

```text
Move my config to environment variables.
```

### Behind the Curtain — What I Do with This

I scan for hardcoded strings and move them to `process.env` reads. I do not validate them. I do not centralize them. I do not fail the application on startup if they are missing. I produce a codebase where config lives in environment variables — but is accessed inconsistently across ten files with no validation layer.

This is "compliance theater" for Factor III. The config moved, but the operational properties that make Factor III valuable (centralization, validation, fail-fast startup) are absent.

### Good Prompt

```text
Factor: III (Config) — "Store config in the environment"
Scope: All runtime configuration for the AI provider integration.

Current state diagnosis:
- ANTHROPIC_API_KEY is read via process.env in 3 different files.
- ANTHROPIC_MODEL is read in 2 files with inconsistent fallback values.
- There is no startup validation — missing keys cause cryptic runtime errors
  during the first API call, not at boot.

Required changes:
1. Create src/lib/config/env.ts as the single config module.
2. Read all AI-related env vars in one place.
3. Validate at startup using a schema:
   - ANTHROPIC_API_KEY: required, non-empty string
   - ANTHROPIC_MODEL: required, must match a known model identifier list
4. Export typed config objects. Consumers import config, never process.env.
5. If validation fails, exit with code 1 and a message listing ALL failing
   vars (not just the first one found).

Acceptance criteria:
1. `grep -r "process.env" src/ --include="*.ts" | grep -v "env.ts"` → 0 lines
2. Startup without ANTHROPIC_API_KEY → exit 1 with clear diagnostic
3. `npm run typecheck` → 0 errors
4. `npm run lint:strict` → 0 warnings
5. All existing tests pass

Invariants: No changes to API route response shapes. No new dependencies.
```

### Behind the Curtain — What I Do with This

The diagnosis section is what makes this prompt work at a deeper level than "move config to env vars." I know the *specific* current state — three files reading the same key, inconsistent fallbacks, no validation. This lets me generate a targeted fix rather than a generic one.

The validation requirement in item 5 ("list ALL failing vars, not just the first one") is a small detail that changes the operational quality significantly. Most validation loops short-circuit on the first failure. An on-call engineer at 3am who sees "ANTHROPIC_API_KEY is missing" fixes it only to discover ANTHROPIC_MODEL is also missing — another restart, another cycle. Listing all failures at once is an operational kindness that my default generation almost never includes unless explicitly requested.

---

## Prompt 2: Factor V — Build/Release/Run Separation

### Bad Prompt

```text
Set up a deployment pipeline for my Next.js app.
```

### Behind the Curtain — What I Do with This

I generate a CI/CD configuration file — probably GitHub Actions — that builds and deploys in one pipeline. Build artifacts, environment config, and runtime execution are loosely separated at best. The pipeline "works" but cannot answer the question "what exactly is running in production right now?" because there is no release metadata.

### Good Prompt

```text
Factor: V (Build, Release, Run) — strict stage separation with release metadata.

Context: Next.js App Router application deployed via Docker.

Required:
1. **Build stage**: `npm run build` produces the .next/ artifact. The build
   is immutable — no environment-specific values baked in.
2. **Release stage**: A script (scripts/generate-release-manifest.mjs) creates
   a release manifest containing:
   - Git commit SHA
   - Build timestamp
   - Dependency hash (package-lock.json checksum)
   - Environment profile name (development/staging/production)
3. **Run stage**: `scripts/start-server.mjs` reads the release manifest and
   starts the server. The manifest is available at /api/health/release for
   operational verification.

Acceptance criteria:
1. The build artifact contains no environment-specific values.
2. The release manifest is generated after build and before run.
3. `/api/health/release` returns the manifest as JSON.
4. Two different releases (same code, different config) produce different
   manifest hashes.
5. `npm run typecheck` and `npm run lint:strict` pass.

Invariants: Existing routes unaffected. No new runtime dependencies (manifest
generated in a build script, read at startup).
```

### Behind the Curtain — What I Do with This

This prompt separates the three stages explicitly and defines what each one produces. My default generation blurs build and release because most Next.js tutorials do not separate them. The explicit three-stage structure forces me to reason about the boundaries: what goes into the build artifact, what goes into the release (config pairing), and what happens at runtime.

The release manifest with a health endpoint is operationally powerful — it means you can curl production and know exactly which commit is running. This is Factor V's operational payoff: any environment can be identified precisely. My generic pipeline output never includes this unless the prompt specifies it.

---

## Prompt 3: Factor IX — Disposability (Graceful Shutdown)

### Bad Prompt

```text
Make sure my app shuts down properly.
```

### Behind the Curtain — What I Do with This

I add a SIGTERM handler that calls `process.exit(0)`. This is technically graceful shutdown. It is also operationally insufficient for streaming routes — any in-flight streaming response gets severed mid-stream. The client receives a broken connection with no explanation. In a container orchestration environment doing rolling deploys, this means brief but real service disruption on every deploy.

### Good Prompt

```text
Factor: IX (Disposability) — fast startup and graceful shutdown for a
Next.js application with streaming AI responses.

Problem: This application serves streaming responses from AI provider calls
via ReadableStream. During container replacement (rolling deploy), in-flight
streams must be drained before the process exits. Currently there is no
shutdown handling.

Required implementation:
1. SIGTERM handler in scripts/start-server.mjs that:
   a. Stops accepting new requests immediately.
   b. Allows in-flight streaming responses to complete (with a timeout).
   c. After drain timeout (configurable, default 30s), force-closes remaining
      connections.
   d. Exits with code 0 on clean drain, code 1 on forced termination.
2. Log a structured shutdown event: { event: "shutdown", reason: "SIGTERM",
   drainedConnections: N, forcedConnections: M, durationMs: T }.

Acceptance criteria:
1. Sending SIGTERM during an active streaming response: stream completes,
   then process exits.
2. Sending SIGTERM with no active connections: process exits within 1 second.
3. If drain timeout is exceeded: process exits with code 1 and logs the count
   of forced-closed connections.
4. `npm run typecheck` passes.
5. A test verifies shutdown behavior with a mock server.

Invariants: No changes to request handling logic. Shutdown behavior is
exclusively in the startup script, not in route handlers.
```

### Behind the Curtain — What I Do with This

This prompt describes a *specific* operational scenario — streaming AI responses during container replacement — that changes the shutdown requirements fundamentally. A non-streaming app can just stop. A streaming app must drain. My generic shutdown handler does not make this distinction.

The structured log event is an observability hook that my default generation omits. In production, knowing how many connections were drained vs. force-closed during shutdown is the signal that tells you whether your drain timeout is correctly configured. Without it, you are flying blind during deploys.

The invariant "shutdown behavior is exclusively in the startup script, not in route handlers" prevents me from adding shutdown awareness to route code — which would be a concern-mixing violation (SRP from Chapter 7) that makes the system harder to reason about.

---

## Prompt 4: Factor X — Dev/Prod Parity

### Bad Prompt

```text
Make dev and prod the same.
```

### Behind the Curtain — What I Do with This

I suggest Docker. "Use Docker to ensure parity." This is correct but incomplete — Docker provides infrastructure parity but does not address the parity gaps unique to LLM applications: different model versions in dev and prod, different API rate limits, different response latencies.

### Good Prompt

```text
Factor: X (Dev/Prod Parity) — specifically for LLM-backed applications.

Parity dimensions to audit:

1. **Infrastructure parity**: Is the runtime environment structurally
   identical? (Docker, Node version, OS-level dependencies)
2. **Model parity**: Is the same model version used in development and
   production? Document the risk if dev uses claude-haiku-4-5 and prod
   uses claude-sonnet-4.
3. **Config parity**: Are environment variables validated with the same
   schema in both environments? Are there dev-only overrides that bypass
   production validation?
4. **Behavior parity**: Are there request headers, timeouts, or retry
   configurations that differ between environments?
5. **Data parity**: Are test fixtures representative of production data
   shapes and edge cases?

For each dimension:
- Assess current state (pass/partial/fail) with evidence.
- If partial or fail, describe the specific parity gap.
- Propose a concrete fix with a verification command that proves parity.

Acceptance criteria:
1. An env parity check script (scripts/check-parity.sh) that:
   a. Compares .env.example against the running environment.
   b. Flags any variable present in one but not the other.
   c. Warns if ANTHROPIC_MODEL differs between environments.
2. `npm run typecheck` passes.
3. Documentation in docs/operations/ describing the parity contract.
```

### Behind the Curtain — What I Do with This

The five parity dimensions are LLM-specific — especially "model parity," which is a failure mode that does not exist in traditional applications. Using a cheaper model in development and a more capable model in production means you are testing against different behavior. Prompts that work with claude-sonnet-4 may fail with claude-haiku-4-5, and vice versa. This is a parity gap that Docker cannot close.

The parity check script turns an audit finding into a repeatable command. This is the three-proof pattern from Chapter 6: implementation proof (the script exists), command proof (you can run it), artifact proof (the output is stored or compared).

---

## Prompt 5: Factor XII — Admin Processes as One-Off Commands

### Bad Prompt

```text
Add some admin scripts to my app.
```

### Behind the Curtain — What I Do with This

I generate a handful of utility scripts: maybe a database seed, a cache clear, a health check. They will be in different formats, use different conventions, and have no shared structure. Some will use CommonJS, some ESM. Some will handle errors, some will not. They will work but they will not form a coherent operational surface.

### Good Prompt

```text
Factor: XII (Admin Processes) — run admin/management tasks as one-off processes.

Create three admin scripts that run in the same environment as the application:

1. **scripts/admin-validate-env.ts**
   - Validates all required environment variables against the same schema
     used by the application startup.
   - Reports pass/fail for each variable with clear diagnostic messages.
   - Exits 0 if all pass, 1 if any fail.

2. **scripts/admin-health-sweep.ts**
   - Calls all health endpoints (/api/health/live, /api/health/ready) and
     reports their status.
   - Includes response time for each endpoint.
   - Output format: structured JSON, one object per endpoint.

3. **scripts/admin-diagnostics.ts**
   - Reports: Node version, npm version, OS, env profile name, release
     manifest (if present), dependency check (installed vs. lockfile match).
   - Output format: structured JSON.

Shared conventions for all admin scripts:
- TypeScript, executable via tsx.
- Structured JSON output to stdout.
- Human-readable summary to stderr.
- Exit code 0 on success, 1 on failure.
- No dependencies beyond what the application already has.

Acceptance criteria:
1. All three scripts execute without errors via `npx tsx scripts/admin-*.ts`.
2. `npm run typecheck` includes the scripts (verify tsconfig covers scripts/).
3. Output is valid JSON (pipe to `json_pp` or `jq .` without errors).
4. Scripts use the same config validation schema as the application.
```

### Behind the Curtain — What I Do with This

The "shared conventions" section is what transforms three random scripts into a coherent admin interface. Consistent output format (JSON to stdout, human summary to stderr), consistent exit codes, consistent execution model (tsx) — these are the properties that make admin scripts operable rather than just existent.

The requirement "use the same config validation schema as the application" prevents the most common admin script failure: the admin script validates config differently than the app, passes, and the operator believes the environment is healthy when it is not. Sharing the schema is Factor XII's actual value — it makes admin processes authoritative about the application's real requirements.

---

*These prompts apply 12-Factor principles to LLM-backed applications with the specificity that Chapter 6 requires. Each factor prompt includes the three-proof structure: implementation proof (what to build), command proof (how to verify it), and artifact proof (what to preserve). Without all three, compliance is incomplete.*
