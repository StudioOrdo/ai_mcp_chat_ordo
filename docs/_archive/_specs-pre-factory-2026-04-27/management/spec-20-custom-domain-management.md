# Spec 20 — Custom Domain Management

## Goal

Enable managed hosting customers to point their own domain to their Ordo instance with minimal technical knowledge. The AI guides them through DNS configuration, verifies the setup, provisions SSL, and confirms when the domain is live — all from the chat.

---

## User Experience

### The Conversational Flow

During onboarding (Spec 18) or at any time via chat:

```
User: "My domain is sunriseyogapdx.com"

AI: "Great! To connect sunriseyogapdx.com to your workspace, you'll need
     to add a DNS record at your domain registrar.

     Go to wherever you manage your domain (GoDaddy, Namecheap, Cloudflare,
     Google Domains, etc.) and add this record:

     Type:  CNAME
     Name:  @  (or leave blank — some registrars differ)
     Value: instances.studioordo.com

     Once you've added it, tell me and I'll check if it's working.
     It usually takes 1-5 minutes to propagate."

User: "Done"

AI: [calls verify_custom_domain tool]
    "Checking... sunriseyogapdx.com is resolving correctly! ✓
     I'm provisioning your SSL certificate now. Your site will be
     live at https://sunriseyogapdx.com within a few minutes."

    [calls provision_domain_ssl tool in background]
    "All set. https://sunriseyogapdx.com is live and secure. 🔒"
```

### If Verification Fails

```
AI: [calls verify_custom_domain tool]
    "I can't see the DNS change yet. This is normal — DNS can take
     up to 48 hours to propagate worldwide, though it's usually
     much faster.

     I'll keep checking in the background and let you know when
     it's working. You can also ask me 'check my domain' anytime."

    [queues a scheduled job to re-verify every 5 minutes for 48 hours]
```

---

## Architecture

### Domain Routing (Reverse Proxy)

```
sunriseyogapdx.com
  → DNS: CNAME instances.studioordo.com
    → Reverse proxy (Caddy)
      → Lookup: hostname → tenant_id
        → Route to tenant's container
```

**Caddy** is the recommended reverse proxy because:
- Automatic HTTPS with Let's Encrypt (zero config)
- On-demand TLS: provisions certs the first time a new hostname is requested
- Simple config: just a domain → upstream mapping
- Handles cert renewal automatically

```
# Caddy config (dynamic via API or config file)
sunriseyogapdx.com {
    reverse_proxy tenant-abc123:3000
}
```

### Domain Registry (Proxy Database)

A domain lookup table maps hostnames to tenant containers:

```sql
CREATE TABLE domain_mappings (
    domain          TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending, verified, active, failed
    dns_verified_at TEXT,
    ssl_provisioned_at TEXT,
    created_at      TEXT NOT NULL
);
```

Statuses:
- `pending`: User claims the domain, DNS not yet verified
- `verified`: DNS resolves correctly to instances.studioordo.com
- `active`: SSL provisioned, traffic being served
- `failed`: DNS verification timed out after 48 hours

### Default Subdomain

Every managed instance gets a default subdomain immediately:
```
{slug}.studioordo.com
```

This works out of the box with a wildcard DNS record and wildcard SSL cert. The custom domain is an upgrade on top of this.

---

## MCP Tools

### `verify_custom_domain`

Called by the AI when the user says they've configured DNS:

```typescript
{
  name: "verify_custom_domain",
  description: "Verify that a custom domain's DNS is pointing to Studio Ordo's infrastructure. Call this when the user says they've updated their DNS records.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "The domain to verify (no protocol)" }
    },
    required: ["domain"]
  }
}
```

**Executor logic:**
1. Perform DNS lookup (CNAME or A record check)
2. Verify it resolves to `instances.studioordo.com` (or Studio Ordo's IP range)
3. If yes: update domain_mappings status to `verified`, trigger SSL provisioning
4. If no: return friendly error with diagnostic info

### `provision_domain_ssl`

Background job (deferred) that provisions SSL via Caddy's API:

```typescript
{
  name: "provision_domain_ssl",
  description: "Provision an SSL certificate for a verified custom domain. This is a background job.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string" }
    },
    required: ["domain"]
  }
}
```

**Executor logic:**
1. Call Caddy's admin API to add the domain route
2. Caddy automatically provisions a Let's Encrypt cert
3. Update domain_mappings status to `active`
4. Update the tenant's `identity.json` domain field
5. Emit a `capability_unlocked` lifecycle event: "Your custom domain is live!"

### `check_domain_status`

For the user to check progress at any time:

```typescript
{
  name: "check_domain_status",
  description: "Check the current status of the user's custom domain configuration.",
  inputSchema: {
    type: "object",
    properties: {},
  }
}
```

---

## DNS Verification Job

When verification fails on the first attempt, schedule a background job (using the existing deferred job system + Spec 06 scheduled execution):

```typescript
// Enqueue a verification retry
await enqueueDeferredToolJob({
  toolName: "verify_custom_domain",
  payload: { domain: "sunriseyogapdx.com" },
  executeAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),  // 5 min
  maxAttempts: 576,  // 5 min × 576 = 48 hours of retries
  retryMode: "auto",
});
```

When verification succeeds during a background retry:
1. Auto-provision SSL
2. Send a chat message to the user: "Great news — sunriseyogapdx.com is now verified and your SSL certificate is active!"

---

## Self-Hosted Domain Management

Self-hosted users manage their own domains:
- They point DNS to their own server
- They configure their own reverse proxy (Caddy, Nginx, etc.)
- The `verify_custom_domain` tool is not available (gated to managed instances)
- They set their domain in `identity.json` manually

The `identity.domain` field already exists and is used for SEO/meta tags. No changes needed for self-hosted.

---

## Files

| Action | File |
|---|---|
| NEW | `src/lib/capabilities/hosting/verify-custom-domain.ts` |
| NEW | `src/lib/capabilities/hosting/provision-domain-ssl.ts` |
| NEW | `src/lib/capabilities/hosting/check-domain-status.ts` |
| NEW | `src/core/capability-catalog/hosting-definitions.ts` |
| MODIFY | `src/lib/config/instance.ts` (write domain to identity config on verification) |

### Separate Service (Hosting Infrastructure)

| Component | Purpose |
|---|---|
| Domain mapping database | hostname → tenant routing |
| Caddy reverse proxy | Auto-SSL, domain routing |
| DNS verification worker | Background polling for CNAME resolution |

---

## Success Criteria

1. A solopreneur can connect their custom domain entirely through the chat — no admin panel, no config file editing.
2. DNS verification runs automatically in the background after the user says they've updated their records.
3. SSL is provisioned automatically with zero user action.
4. The user receives a chat notification when their domain goes live.
5. Default `{slug}.studioordo.com` subdomain works immediately on instance creation.
6. Domain verification retries for up to 48 hours (covering slow DNS propagation).
7. Self-hosted users are unaffected — they manage their own domains.
