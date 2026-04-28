---
title: Daily practice
audience: staff
class: training
rolePersona: operator
---

Daily operator practice is a short, repeatable check. It is not a
substitute for incident response, and it is not the place to triage
customer issues — those belong in `/admin/leads` and the conversations
surface.

The daily check has three steps.

1. **Job queue health.** Open `/admin/jobs`. Look at failed jobs from
   the last 24 hours. If a job failed because of a transient provider
   error, you can retry it. If it failed for a reason you do not
   recognize, leave it failed and record it in the next handoff note
   — do not retry blind.
2. **Prompt control plane.** Open `/admin/prompts`. Confirm every
   governed slot has an active version. Missing active versions mean
   the runtime is falling back to hardcoded defaults, which is fine
   temporarily but should be resolved.
3. **Content visibility.** Open `/admin/content-visibility`. Scan the
   drift column. A book tagged `audience: public` with zero visible
   public sections is a drift case: either the manifest is wrong, or
   the sections were authored at a narrower audience by mistake.

These three checks are the minimum. They exist so that silent drift
does not accumulate between incident-driven work.
