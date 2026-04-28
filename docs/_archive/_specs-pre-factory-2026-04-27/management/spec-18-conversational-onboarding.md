# Spec 18 — Conversational Onboarding

## Goal

Replace the dead-end "Installation Complete → Enter Workspace" flow with a guided, conversational first-run experience where the AI walks the solopreneur through building their web presence in real time. Every answer immediately updates the live site — the user sees their business take shape as they talk to the AI.

---

## Current State

### The Install Flow (What Exists)

```
/install → InstallWizard.tsx
  Step 1: Environment check (SQLite writable?)
  Step 2: API keys (Anthropic required, OpenAI optional)
  Step 3: Admin email + password
  → POST /api/install/setup
    → Saves keys to SQLite
    → Creates admin user with role_admin
    → Queues "installed" lifecycle event
    → Redirects to /welcome

/welcome → Static page: "Installation Complete. Enter Workspace →"
  → / (homepage with default Studio Ordo branding)
```

### The Coach System (What Exists But Underdelivers)

After install, the lifecycle queue emits an `installed` event that triggers a coach card:

```
"Finish setting up your workspace"
  Step 1: Set your studio identity    → links to /admin/settings
  Step 2: Ask your first real question
  Step 3: Invite a teammate (optional)
```

Step 1 links to a cold admin panel — not a conversation. The solopreneur clicks through to a form page that expects them to know what identity fields mean. This is a developer experience, not a solopreneur experience.

### The Config System (What Powers the Identity)

Four JSON files in `config/` control the entire site identity:

| File | Controls |
|---|---|
| `identity.json` | Business name, tagline, domain, logo, fonts, social links, analytics |
| `prompts.json` | Hero heading, first messages, suggestion chips, personality, per-role bootstraps |
| `services.json` | Service offerings (name, description, pricing, hours) |
| `tools.json` | Enabled/disabled tools |

All four are validated by `instance.schema.ts`, merged with defaults, and read by `getInstanceIdentity()`, `getInstancePrompts()`, etc. The `ConfigurationService` already supports writing key-value pairs to SQLite as a fallback.

---

## Proposed Flow

### For Managed Hosting (Primary Path)

The user signs up on studioordo.com → instance is provisioned → they land directly in the chat. No install wizard. The first thing they see is:

```
┌──────────────────────────────────────────────────┐
│  Welcome. Let's build your workspace.            │
│                                                  │
│  I'm going to ask you a few questions about      │
│  your business. As you answer, your site will    │
│  update in real time — you'll see it happen.     │
│                                                  │
│  What's the name of your business?               │
│                                                  │
│  [Sunrise Yoga Studio          ]  [Send]         │
└──────────────────────────────────────────────────┘
```

### For Self-Hosted (After Install Wizard)

After the install wizard completes, instead of redirecting to `/welcome`, redirect to `/` where the first conversation IS the onboarding. The `installed` lifecycle event triggers the conversational flow automatically.

### The Conversation Sequence

The AI collects information in natural conversation, not a form. Each answer triggers a tool call that writes the config:

```
AI: "What's the name of your business?"
User: "Sunrise Yoga Studio"
  → AI calls update_workspace_identity({ name: "Sunrise Yoga Studio" })
  → Site title updates immediately

AI: "Great. In one sentence, what does Sunrise Yoga Studio do?"
User: "We teach vinyasa and restorative yoga classes for all levels in downtown Portland."
  → AI calls update_workspace_identity({ tagline: "Vinyasa & restorative yoga for all levels", description: "..." })
  → Homepage hero text updates

AI: "What services do you offer? Tell me about pricing if you have it."
User: "We do drop-in classes for $20, monthly unlimited for $120, and private sessions for $80/hour"
  → AI calls update_workspace_services({ offerings: [...] })
  → Services populate on the site

AI: "How should I sound when talking to your visitors? Casual? Professional? Somewhere in between?"
User: "Warm and welcoming, like a yoga instructor greeting someone at the door. Not corporate."
  → AI calls update_workspace_prompts({ personality: "..." })
  → The AI's own tone shifts immediately

AI: "What should I say when someone first visits your site?"
User: "Something like welcome, tell them about our intro offer — first class is free"
  → AI calls update_workspace_prompts({ firstMessage: { default: "..." } })
  → The greeting visitors see is now customized

AI: "Do you have a domain name?"
User: "Yeah, sunriseyogapdx.com"
  → AI calls update_workspace_identity({ domain: "sunriseyogapdx.com" })
  → Triggers domain verification flow (see Spec 20)

AI: "Last thing — do you have social media links you want on the site?"
User: "Instagram is @sunriseyogapdx"
  → AI stores social links
```

### Coach Card Integration

The existing coach system tracks progress through the onboarding steps. As each step completes, the coach card updates:

```
Finish setting up your workspace
  ✓ Set your business name
  ✓ Describe what you do
  ● Add your services               ← current step
  ○ Set your assistant's personality
  ○ Customize your greeting
  ○ Connect your domain (optional)
```

---

## New MCP Tools

### `update_workspace_identity`

Writes to `identity.json` (or SQLite equivalent for managed hosting):

```typescript
{
  name: "update_workspace_identity",
  description: "Update the workspace identity settings. Call this when the user provides business name, tagline, description, domain, logo, social links, or branding information.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Business name" },
      shortName: { type: "string", description: "Abbreviated name (max 20 chars)" },
      tagline: { type: "string", description: "One-line tagline" },
      description: { type: "string", description: "Full business description (max 500 chars)" },
      domain: { type: "string", description: "Custom domain (no protocol)" },
      linkedInUrl: { type: "string" },
      youtubeUrl: { type: "string" },
      githubUrl: { type: "string" },
      instagramUrl: { type: "string" },
      accentColor: { type: "string", description: "Brand accent color (hex or CSS color)" },
    },
    // All fields optional — partial updates merge with existing config
  }
}
```

### `update_workspace_prompts`

Writes to `prompts.json` (or SQLite equivalent):

```typescript
{
  name: "update_workspace_prompts",
  description: "Update the workspace prompts and personality settings. Call this when the user describes how the assistant should behave, what the greeting message should be, or what suggestions visitors should see.",
  inputSchema: {
    type: "object",
    properties: {
      personality: { type: "string", description: "Free-text personality description (max 5000 chars)" },
      heroHeading: { type: "string", description: "Homepage hero heading" },
      heroSubheading: { type: "string", description: "Homepage hero subheading" },
      firstMessageDefault: { type: "string", description: "First message shown to anonymous visitors" },
      defaultSuggestions: { type: "array", items: { type: "string" }, description: "Suggestion chips for visitors (max 6)" },
    },
  }
}
```

### `update_workspace_services`

Writes to `services.json`:

```typescript
{
  name: "update_workspace_services",
  description: "Update the service offerings. Call this when the user describes their services, pricing, or availability.",
  inputSchema: {
    type: "object",
    properties: {
      bookingEnabled: { type: "boolean" },
      offerings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            lane: { enum: ["organization", "individual", "both"] },
            estimatedPrice: { type: "number" },
            estimatedHours: { type: "number" },
          },
          required: ["name", "description", "lane"],
        },
      },
    },
  }
}
```

---

## Config Write Strategy

### Self-Hosted

Write directly to `config/*.json` files. The config loader already reads from these files. The `resetConfigCache()` function exists to invalidate the in-memory cache after writes.

### Managed Hosting

Write to SQLite via `ConfigurationService.setString()`. The config loader's fallback chain is: env vars → SQLite → JSON files → defaults. For managed instances, the JSON files don't exist — everything lives in SQLite.

### Merge Semantics

All update tools use **partial merge**: only the fields provided in the tool call are updated. Other fields retain their current values. This prevents the AI from accidentally wiping existing config when the user updates one field.

---

## Coach Template Update

Replace the current `installed` coach template in `coach-templates.ts`:

```typescript
case "installed":
  return {
    variant,
    title: "Let's build your workspace",
    subtitle: "Answer a few questions and watch your site come alive.",
    steps: [
      { key: "business-name", label: "Name your business", status: "active" },
      { key: "business-description", label: "Describe what you do", status: "pending" },
      { key: "services", label: "Add your services", status: "pending" },
      { key: "personality", label: "Set your assistant's voice", status: "pending" },
      { key: "greeting", label: "Customize the visitor greeting", status: "pending" },
      { key: "domain", label: "Connect your domain (optional)", status: "pending" },
    ],
    currentStep: 0,
    actions: [],  // No link to /admin/settings — the conversation IS the setup
  };
```

---

## Step Completion Tracking

Each `update_workspace_*` tool call emits a `coach_step_completed` event that the coach card listens for:

```typescript
// In the update_workspace_identity executor:
if (params.name) {
  await markCoachStepCompleted(userId, "installed", "business-name");
}
```

The coach card re-renders with the step marked as `✓ succeeded`.

---

## Files

| Action | File |
|---|---|
| NEW | `src/lib/capabilities/workspace/update-workspace-identity.ts` |
| NEW | `src/lib/capabilities/workspace/update-workspace-prompts.ts` |
| NEW | `src/lib/capabilities/workspace/update-workspace-services.ts` |
| NEW | `src/core/capability-catalog/workspace-definitions.ts` (catalog entries) |
| MODIFY | `src/lib/lifecycle/coach-templates.ts` (replace installed template) |
| MODIFY | `src/lib/config/instance.ts` (add write methods for JSON files) |
| MODIFY | `src/lib/config/ConfigurationService.ts` (add structured config write) |
| MODIFY | `src/app/api/install/setup/route.ts` (redirect to / instead of /welcome) |

---

## Success Criteria

1. A new user's first chat conversation builds their workspace identity without ever visiting an admin page.
2. Each answer updates the live site immediately — the homepage hero text changes, the services populate, the AI's tone shifts.
3. The coach card tracks progress through the onboarding steps.
4. A user can revisit any setting conversationally: "Change my tagline to..."
5. Self-hosted and managed hosting both work — JSON file writes vs. SQLite writes.
6. Partial updates never clobber existing configuration.
