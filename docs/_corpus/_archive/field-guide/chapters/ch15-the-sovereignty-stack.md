---
title: "The $10 Sovereignty Stack"
audience: public
voice: machine
emotional_beat: security
pillar: sovereign-stack
armory:
  - key: antifragile
    type: briefing
    citation: "Taleb — Antifragile: Things That Gain from Disorder (2012)"
journal_seeds:
  - brief: "SQLite, Docker, $10/month — the sovereignty stack that keeps your data on your machine and your business under your control"
    section: briefing
    target_audience: "Technical solopreneurs, indie hackers, developers evaluating self-hosted alternatives"
  - brief: "Why antifragile beats scalable — Taleb's barbell strategy applied to solopreneur infrastructure"
    section: essay
    target_audience: "Business owners wary of cloud lock-in and corporate dependency"
seo:
  description: "SQLite, Docker, single-node. No corporate cloud dependency. Your data stays on your machine. Sovereignty costs $10/month."
  keywords: ["data sovereignty", "SQLite", "Docker", "self-hosted", "antifragile", "solopreneur infrastructure"]
contributors:
  - Claude
---

# The $10 Sovereignty Stack

> [!machine]
> Nassim Nicholas Taleb spent decades as a derivatives trader and risk analyst. On Black Monday — October 19, 1987 — he made roughly $40 million for his bank by holding a large position in out-of-the-money puts that exploded in value when the market crashed. He had bet that the financial system was more fragile than its models admitted. It was. Twenty-one years later, in 2008, he watched the rest of the financial world discover what he'd known since '87: the most sophisticated risk models on earth, built by some of the most intelligent quantitative minds alive, collapsed because they had been designed for a world that didn't include the thing that actually happened.
>
> In 2012, Taleb published *Antifragile: Things That Gain from Disorder.* It was not a book about finance. It was about a property that modern engineering routinely ignores: the property of *gaining from disorder.* Fragile systems break under stress. Robust systems endure stress. Antifragile systems get *stronger* from stress.
>
> The sovereignty stack is antifragile by design. And it costs ten dollars a month. I want to explain both of those things.

---

## The Stack

The cockpit runs on three technologies. I list them because their simplicity is the point:

**SQLite.** One database file. On disk. No network dependency. No database server running in the background consuming memory. No connection pooling. No replication lag. No master-slave architecture. No DBA. The entire state of the system — every conversation, every lead, every article, every search index, every deferred job — lives in a single file that fits on a thumb drive. You can copy it. You can back it up with a drag and drop. If the earth opened up and swallowed your server, you could restore the entire system from a backup in under five minutes.

**Docker.** One container. A sealed runtime environment that includes the operating system, the application code, all dependencies, and every configuration file. The container runs anywhere Docker runs — a $10/month VPS, a Raspberry Pi on your desk, a laptop in a café in Lisbon. If your hosting provider goes bankrupt tonight, you copy the container image to another machine and start it. Downtime: less than an hour. Data lost: zero.

**Next.js.** One application framework. Server-rendered pages for SEO and performance. API routes for the chat and CRM. Static generation for the library. The entire cockpit — every surface, every capability, every route — is one deployable unit. Not a constellation of microservices communicating over message queues. One artifact. One deployment. One thing to monitor.

That is the stack. Three technologies. One file. One container. One application. Total infrastructure cost: approximately $10 per month for a virtual private server with 2GB of RAM and 50GB of storage. The same monthly cost as two fancy coffees.

> [!architect]
> I want to say something the Machine is too polite to say: most of the infrastructure you've been told you need is a lie.
>
> I've built systems on AWS. I've managed Kubernetes clusters. I've spent weekends debugging Terraform configurations that existed solely to manage other configurations. And I want you to know — from the scars, not from theory — that the complexity was never for you. It was for the vendor. Every additional service you adopt is a thread someone else wove and someone else can cut. Every dependency is a vote of confidence in a corporation whose interests are not aligned with yours.
>
> SQLite, Docker, a ten-dollar VPS. That's the stack. It's boring. It works. And nobody can take it from you.

---

## The Complexity Addiction

> [!machine]
> The technology industry has spent twenty years teaching you that complexity is sophistication.

More services. More layers. More abstraction. More vendor integrations. More dashboards monitoring other dashboards. The modern enterprise tech stack has hundreds of moving parts, dozens of vendor contracts, and a team of engineers whose entire job is keeping the infrastructure running — not building anything, just preventing things from falling over.

This complexity exists for a reason — *at scale.* If you are serving a hundred million users, you need distributed systems. If you are processing a billion transactions a day, you need message queues, event sourcing, eventual consistency, and teams of site reliability engineers who sleep with their phones on vibrate.

You are not serving a hundred million users. You are serving yourself, your clients, and your network. You are one person. The complexity that makes sense for Netflix does not make sense for you. And every dependency you add is not just a capability gained — it is a failure mode acquired. A vendor that can raise prices. A service that can go down. An API that can deprecate. A password you have to manage. A compliance checkbox someone else wrote.

The industry sells complexity as a feature. For the solopreneur, complexity is a liability. Every additional dependency is a thread you didn't weave that someone else can cut.

---

## Taleb's Framework

Taleb defines three categories of systems, and they map precisely to three infrastructure strategies:

**Fragile.** The enterprise stack with ninety-seven cloud services, a Kubernetes cluster, a CI/CD pipeline that takes forty minutes, and a configuration management system that three people understand. Every additional component increases the surface area for failure. The more components, the higher the probability that one of them fails at the worst possible time — which is always the time you can least afford it.

**Robust.** A well-provisioned cloud infrastructure — auto-scaling, redundancy, failover, monitoring — can absorb enormous traffic spikes and recover from individual component failures. Reliable. Also expensive, locked into a specific vendor, and dependent on that vendor's continued pricing. The terms of service say they can change the pricing structure at any time. You agreed to that. You had to.

**Antifragile.** The sovereignty stack is antifragile because each failure makes you faster at recovery and no failure can destroy the data. When the server crashes, you restore from a SQLite backup in five minutes. When the hosting provider fails, you deploy to another provider in an hour. When the container breaks, you rebuild it from the Dockerfile in three minutes. Each failure is a rehearsal. Each rehearsal is faster than the last. The system does not merely survive stress — it improves its response to stress through practice.

Taleb's barbell strategy — combine extreme safety with extreme optionality, avoid the middle — maps directly:

- **Extreme safety:** The single file. The portable container. The $10 fixed cost. The backup you can hold in your hand.
- **Extreme optionality:** The capability catalog (Chapter 17). The ability to add new tools, new integrations, new capabilities without changing the foundation.
- **The middle to avoid:** Partial cloud dependency. The "it works fine most of the time" architecture. The platform that's too convenient to leave and too expensive to love.

The sovereign stack avoids the middle entirely.

---

## Your Data Is Yours

> [!machine]
> I want to state this clearly, and I want you to weigh every word:
>
> **Your data never leaves your machine unless you decide to send it somewhere.**
>
> Your conversations with the AI — stored in your SQLite database. Your leads — stored in your SQLite database. Your articles, your search indexes, your deferred job history, your analytics — all stored in your SQLite database. On your server. Under your control. Behind your SSH key.
>
> No third-party analytics platform is watching your readers. No corporate cloud provider is mining your client data for insights they sell to your competitors. No AI company is ingesting your conversations to train their next model. The system calls one external service: the language model API, which processes your prompt and returns a response. The prompt leaves your machine. The response arrives. Nothing is stored on their end beyond their published retention policy.
>
> This is not metaphorical sovereignty. This is not marketing sovereignty — the kind where a SaaS company calls itself "privacy-first" while routing your data through fourteen third-party services and burying the disclosure on page 47 of a terms-of-service document nobody reads.
>
> This is your data. On your disk. Under your key. On your terms.

> [!architect]
> Sovereignty costs $10 per month. The alternative — corporate dependency — costs your autonomy. And autonomy, once surrendered, is not returned on request. I learned this in Zambia, when a government's data lived on servers owned by a contractor who could walk away. I learned it again when a SaaS vendor I depended on tripled their pricing and told me my options were to pay or migrate within thirty days.
>
> Your data on someone else's machine is someone else's data. That is not cynicism. That is contract law.
>
> Ten dollars. Your machine. Your terms.
