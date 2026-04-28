---
title: First login
audience: staff
class: training
rolePersona: operator
---

The first thing to do after your admin account is provisioned is confirm
that the surfaces you are expected to operate each render correctly for
your session.

1. Sign in at `/login`.
2. Confirm the header shows your name and an admin or staff badge.
3. Open `/admin`. If the page renders, admin gating is working.
4. Open `/admin/jobs`. Confirm that the deferred-job queue loads (even
   if it is empty).
5. Open `/admin/prompts`. Confirm the prompt control plane lists `base`
   and `role_directive` slots for each role.

If any of these surfaces fail to render for a provisioned admin user,
that is the first thing to escalate. Every other operational task in
this handbook assumes these four surfaces are reachable.

Nothing in this chapter is end-user facing. If your session shows this
content, you are inside the staff training surface at
`/admin/training/operators-handbook/first-login`.
