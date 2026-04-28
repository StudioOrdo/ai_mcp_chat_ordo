# Spec 19 — Managed Hosting & Token Metering

## Goal

Define the architecture for Studio Ordo's managed hosting offering where the customer buys tokens through Studio Ordo and the hosting cost is built into the token price. One bill. No separate infrastructure fees.

---

## Business Model

```
Customer buys tokens → Studio Ordo proxy forwards to Anthropic/OpenAI
                     → Token cost includes margin that covers:
                        ├── AI provider cost (pass-through)
                        ├── Compute (container hosting)
                        ├── Storage (S3/MinIO for media + Litestream for SQLite)
                        ├── CDN (CloudFront for media delivery)
                        ├── Domain management (auto-SSL, DNS verification)
                        └── Profit margin
```

### Pricing Philosophy

- No monthly subscription. Usage-based only.
- Dormant instances cost nearly nothing (cold container, minimal S3).
- Active instances pay proportionally to value received.
- Most solopreneurs land in the $20-40/month range with normal usage.

---

## Architecture

### Instance Isolation (Single-Tenant)

Each managed customer gets their own isolated instance:

```
┌─────────────────────────────────────┐
│  Customer Instance                   │
│  ├── Container (Docker)              │
│  │   ├── Next.js app (Ordo)          │
│  │   ├── SQLite database (local SSD) │
│  │   └── Litestream → S3 (backup)    │
│  ├── S3 prefix: /tenants/{id}/       │
│  │   ├── media/    (generated assets)│
│  │   ├── corpus/   (library docs)    │
│  │   └── backups/  (SQLite WAL)      │
│  └── Domain: custom or {slug}.studioordo.com │
└─────────────────────────────────────┘
```

- **SQLite stays local** to the container's filesystem for performance. Litestream continuously replicates WAL changes to S3 for durability.
- **Media assets** are written to S3 via a `StorageAdapter` abstraction. Served via CloudFront CDN.
- **Config** lives in SQLite (no `config/` JSON files for managed instances). The `ConfigurationService` fallback chain already supports this.

### Token Proxy

```
Customer's Ordo instance → Studio Ordo Proxy → Anthropic API
                              ↓
                         Meter usage
                         (input_tokens, output_tokens, model, timestamp)
                              ↓
                         Usage ledger (per tenant)
```

The proxy is a lightweight service that:
1. Receives the Anthropic/OpenAI API request from the customer's instance
2. Validates the Studio Ordo API key
3. Checks the customer's credit balance (reject if exhausted)
4. Injects the real Anthropic/OpenAI API key
5. Forwards the request
6. Records token usage from the response
7. Returns the response to the instance

### Studio Ordo API Key

Managed instances don't store Anthropic/OpenAI keys. They store a single `STUDIO_ORDO_API_KEY` that authenticates with the proxy.

```
# Self-hosted instance (bring your own keys)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Managed instance (proxy key)
STUDIO_ORDO_API_KEY=so-...
ANTHROPIC_API_KEY=  (empty — proxy handles it)
AI_PROXY_URL=https://api.studioordo.com/v1
```

The Anthropic client adapter needs a small change: if `AI_PROXY_URL` is set, route requests through the proxy instead of directly to Anthropic.

---

## Storage Adapter Abstraction

### Interface

```typescript
interface StorageAdapter {
  /** Write a file, returns the canonical URL for retrieval. */
  write(key: string, data: Buffer, metadata?: FileMetadata): Promise<string>;
  
  /** Read a file by key. */
  read(key: string): Promise<Buffer>;
  
  /** Get a public-facing URL for the file (CDN URL or local path). */
  getPublicUrl(key: string): string;
  
  /** Delete a file. */
  delete(key: string): Promise<void>;
  
  /** Check if a file exists. */
  exists(key: string): Promise<boolean>;
}
```

### Implementations

**`LocalStorageAdapter`** (self-hosted):
- Writes to local filesystem (`user-files/`, `_corpus/`)
- URLs are `/api/files/{key}`
- Current behavior, extracted into adapter pattern

**`S3StorageAdapter`** (managed hosting):
- Writes to S3 with tenant-prefixed keys: `tenants/{tenantId}/media/{key}`
- URLs are CloudFront CDN URLs: `https://cdn.studioordo.com/tenants/{id}/media/{key}`
- Uses `@aws-sdk/client-s3` (or MinIO-compatible endpoint)

### Configuration

```
STORAGE_BACKEND=local|s3
S3_BUCKET=studioordo-assets
S3_REGION=us-east-1
S3_ENDPOINT=         (empty for real S3, MinIO URL for self-hosted)
CDN_BASE_URL=https://cdn.studioordo.com
TENANT_ID=           (set during provisioning for managed instances)
```

---

## SQLite Backup with Litestream

### For Managed Hosting

Each container runs Litestream as a sidecar process:

```yaml
# litestream.yml
dbs:
  - path: /data/ordo.db
    replicas:
      - type: s3
        bucket: studioordo-backups
        path: tenants/${TENANT_ID}/db
        region: us-east-1
        sync-interval: 1s
```

On container start:
1. Restore latest SQLite snapshot from S3
2. Start Ordo
3. Litestream streams WAL changes continuously

On container crash:
1. New container starts
2. Restore from S3 (<10 seconds)
3. Resume operation with <1 second of data loss (worst case)

### For Self-Hosted

Litestream is optional. Users can back up SQLite however they want (cron + cp, rsync, etc.). We document the Litestream option for users who want S3 backups.

---

## Token Metering

### Usage Recording

Every LLM API call records usage in the proxy's ledger:

```typescript
interface UsageRecord {
  tenantId: string;
  timestamp: string;       // ISO-8601
  model: string;           // claude-sonnet-4-20250514, gpt-4o, etc.
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costCents: number;       // calculated from provider pricing + margin
  conversationId?: string; // for attribution
  toolName?: string;       // if this was a tool-triggered call
}
```

### Balance & Limits

Each tenant has a credit balance:

```typescript
interface TenantAccount {
  tenantId: string;
  creditBalanceCents: number;  // prepaid credits remaining
  monthlyLimitCents: number;  // optional spending cap
  currentMonthUsageCents: number;
  status: "active" | "suspended" | "exhausted";
}
```

When `creditBalanceCents` reaches 0 or `currentMonthUsageCents` exceeds `monthlyLimitCents`:
- The proxy returns a `402 Payment Required` response
- The instance shows a user-friendly message: "Your credits are running low. Add more at studioordo.com/account"
- The system continues to serve the static website (homepage, blog) — only AI interactions are gated

### Usage Dashboard

The admin panel shows:

```
This Month's Usage
├── Total tokens:    1,247,000
├── Total cost:      $23.41
├── Credits remaining: $76.59
│
├── By capability:
│   ├── Chat:            842,000 tokens ($15.80)
│   ├── Media generation: 312,000 tokens ($5.85)
│   └── Search:           93,000 tokens ($1.76)
│
└── Daily trend: [sparkline chart]
```

---

## Instance Provisioning

### Flow

```
1. Customer signs up at studioordo.com
2. Provisioning service:
   a. Creates a tenant record (UUID, email, plan)
   b. Generates a STUDIO_ORDO_API_KEY
   c. Creates S3 prefix: tenants/{tenantId}/
   d. Spins up a container with env vars:
      - STUDIO_ORDO_API_KEY=so-...
      - AI_PROXY_URL=https://api.studioordo.com/v1
      - STORAGE_BACKEND=s3
      - S3_BUCKET=studioordo-assets
      - TENANT_ID={tenantId}
      - LITESTREAM_REPLICA_URL=s3://studioordo-backups/tenants/{tenantId}/db
   e. Runs /api/install/setup with the tenant's email and a generated password
   f. Assigns {slug}.studioordo.com subdomain
3. Customer receives email: "Your workspace is ready at {slug}.studioordo.com"
4. Customer logs in → conversational onboarding begins (Spec 18)
```

### Provisioning Time Target

Under 60 seconds from signup to a running instance. The container image is pre-built; provisioning is mostly S3 prefix creation + container launch.

---

## Files

| Action | File |
|---|---|
| NEW | `src/adapters/storage/StorageAdapter.ts` (interface) |
| NEW | `src/adapters/storage/LocalStorageAdapter.ts` |
| NEW | `src/adapters/storage/S3StorageAdapter.ts` |
| NEW | `src/adapters/AiProxyClient.ts` (proxy-aware Anthropic client) |
| MODIFY | `src/lib/config/env-config.ts` (add S3, proxy, tenant env vars) |
| MODIFY | `src/adapters/ChatStreamAdapter.ts` (route through proxy when configured) |
| MODIFY | `src/lib/chat/anthropic-stream.ts` (use proxy URL when set) |
| MODIFY | Media asset write paths (use StorageAdapter instead of direct fs) |

### Separate Service (Not in Ordo Codebase)

| Component | Purpose |
|---|---|
| Token Proxy | Validates keys, injects provider keys, meters usage |
| Provisioning API | Creates tenants, launches containers, manages DNS |
| Billing Dashboard | Customer-facing usage and credit management |
| Container Orchestrator | Manages container lifecycle (Docker Swarm, K8s, or Fly.io) |

---

## Self-Hosted Compatibility

Everything in this spec is additive. Self-hosted instances:
- Use `STORAGE_BACKEND=local` (default)
- Use their own API keys directly (no proxy)
- Don't run Litestream (optional)
- Don't have a `TENANT_ID`
- Don't need a token proxy

The `StorageAdapter` abstraction benefits self-hosted users too — it cleans up the file access patterns regardless of backend.

---

## Success Criteria

1. A managed hosting customer can go from signup to a running instance in under 60 seconds.
2. The customer never sees or manages API keys — token usage is metered and billed automatically.
3. Media assets are stored in S3 and served via CDN with global edge caching.
4. SQLite is continuously backed up via Litestream. Container crash → recovery in <10 seconds.
5. Self-hosted users experience zero changes — `STORAGE_BACKEND=local` is the default.
6. The static website (homepage, blog, services) continues to serve even when credits are exhausted.
