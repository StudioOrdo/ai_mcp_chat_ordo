# Product Model

## Core Metaphor
- User: CEO, founder, paying customer, student, or member.
- Ordo: executive assistant, chief of staff, operator, and coach.
- Business units: specialized offices that own services.
- Shared infrastructure: identity, jobs, assets, memory, notifications, config,
  search, prompt governance, and execution timelines.

## Business Units
| Unit | Purpose | Current System Capabilities |
| --- | --- | --- |
| Customer Workspace | Restore context, active work, assets, memory, and continuation state. | Workspace restore/snapshot readers, conversations, relationship memory, active jobs, asset catalog. |
| Knowledge Office | Search paid knowledge, retrieve sections, package source-backed answers. | Corpus search, section retrieval, search index, knowledge access service. |
| Media Studio | Create personalized audio, visuals, and composed media. | `generate_audio`, `compose_media`, chart/graph generation, media worker, asset catalog. |
| Job Operations | Track async work, retries, failures, and materialized outputs. | Deferred jobs, canonical job read model, event streams, materialization records. |
| Product Factory | Turn a brief into staged production work. | `produce_product`, work orders, DAG planner, stage executors, QA, revision, checkpoints. |
| Content Studio | Draft, QA, revise, publish, and store content/library artifacts. | Blog/journal tools, blog production service, hero image assets, corpus/library paths. |
| Client Pipeline | Capture and triage leads or consultation intent. | Lead capture, consultation requests, admin triage/routing tools. |
| Deal Desk | Convert qualified opportunities into scoped deals. | Deal records, deal creation routes/interactors. |
| Training Office | Convert individual prospects/students into training paths. | Training path records and workflow interactors. |
| Referral Office | Manage affiliate QR, referral activity, credits, exceptions, and performance. | Referral ledger, referral analytics, affiliate tools, QR routes. |
| Founder Coach | Help the user prioritize, debrief, plan, and improve operating behavior. | Lifecycle context, coach templates, memory, jobs, workspace state. |
| Operations Desk | Inspect system health, jobs, logs, runtime behavior, admin search. | Admin search, runtime logs, health probes, operations sidecar. |
| Identity & Access | Manage users, roles, profile, account state, and tool assignment. | Auth, roles, profile service, user admin pages, profile tools. |
| System Control Plane | Configure Ordo behavior, notifications, roles, prompts, and feature surfaces. | Prompt control plane, preferences, config modules, admin routes. |

## Role Model
| Role | Product Meaning | Default Rights |
| --- | --- | --- |
| Anonymous | Visitor/lead. | Public content, limited chat, local theme/accessibility, lead capture. |
| Authenticated | Paying customer, student, member, or signed-up user. | Paid knowledge, personalized media, profile, jobs, assets, referrals if enabled, bug/support submission. |
| Apprentice | Higher-touch student/operator-in-training. | Authenticated rights plus deeper coaching/training experiences. |
| Staff | Internal support/operator. | Help users, review pipeline, affiliate operations, business state. No logs/system config by default. |
| Admin | Founder/operator owner. | Full operations, logs, user management, prompt governance, config, staff/admin surfaces. |

## User Workflows
Common authenticated-user workflows:
- Ask questions against the knowledge/library corpus.
- Create personalized media from conversation context.
- Reuse previous generated assets.
- Track jobs and open results.
- Change theme/accessibility and profile preferences.
- View affiliate QR, referral performance, and referral activity when enabled.
- Submit bug reports/support issues without seeing logs.

Common staff/admin workflows:
- Review affiliate performance and exceptions.
- Review leads, routing risk, deals, and training paths.
- Inspect jobs, work orders, and execution timelines.
- Govern prompts and runtime behavior.
- Manage users, roles, and enabled capabilities.
- Investigate bugs with logs and diagnostics.

## Product Rule
Users should experience services, not implementation tools.

Business units may have many internal procedures, but Ordo should expose a
small contextual service menu per role and task.

