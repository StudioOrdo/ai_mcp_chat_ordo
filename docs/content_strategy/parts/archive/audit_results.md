# Ordo Corpus Audit: The Path to the Solopreneur Strategy

## 1. Overview
The current Ordo Corpus consists of 11 distinct books (distributed across 12 directories including an archive). The narrative is intellectually rigorous but suffers from terminological drift and structural fragmentation. This audit identifies the key areas for consolidation and standardization to enable a "Solopreneur-first" help system.

## 2. Terminology Mapping (Friction Points)

The following terms are used inconsistently across the corpus. To achieve cohesiveness, these will be standardized to **Solopreneur** or closely related variants.

| Current Term | Frequency (Approx) | Context | Proposed Standard |
| :--- | :--- | :--- | :--- |
| **Sovereign Agent** | 45+ | Philosophical / Book I & II | Solopreneur / Sovereign Solopreneur |
| **Sovereign Student** | 30+ | Educational / Book X & VIII | Solopreneur / Student Solopreneur |
| **Builder** | 100+ | Technical / Book VII | The Solopreneur Builder |
| **Forward Deployed Engineer** | 20+ | Career Strategy / Book I & VII | Solopreneur Operator |
| **Operator** | 40+ | Technical / Book 00 | The Solopreneur Operator |

## 3. Structural Consolidation (Proposed Volumes)

The 11-book structure (Book 00 to Book X) is being rationalized into 5 Core Volumes.

| Volume | Name | Books Included | Focus |
| :--- | :--- | :--- | :--- |
| **Vol 1** | **The Thesis** | `second-renaissance`, `sources-and-lineage` | The "Why": Historical and economic context. |
| **Vol 2** | **The Identity** | `identity-system`, `archetype-atlas` | The "Who": Narrative, archetype, and persona. |
| **Vol 3** | **The Signal** | `perception`, `trust-proof`, `signal-and-deployment` | The "What": Visual design, trust, and market signal. |
| **Vol 4** | **The System** | `building-ai-native`, `system-docs` | The "How": Technical architecture and operation. |
| **Vol 5** | **The Path** | `curriculum-architecture`, `formation-and-governance` | The "Process": Education, ethics, and long-term formation. |

## 4. System Capabilities & Help Logic

### Current Web & API Capabilities (The Solopreneur Operator System):
The research deep-dive has revealed that Studio Ordo is not just a chat interface, but a full-fledged CRM, affiliate, and access management system for the Solopreneur. The help documentation must cover these active code paths:

1. **The Affiliate & QR Code System (`src/app/api/qr/...`, `src/core/entities/Referral.ts`)**: 
   - A complete 9-stage referral lifecycle from `visited` and `engaged` to `credited`. 
   - Automatically generates QR codes mapped to user referral codes (enabled via `affiliateEnabled`).
2. **The Deal CRM Pipeline (`src/core/entities/deal-record.ts`)**:
   - Manages deals across lanes (`organization`, `development`) through multiple stages (`draft`, `qualified`, `estimate_ready`, `agreed`). 
   - Captures scoping metrics like estimated hours, pricing, and training days directly from chat flow workflows.
3. **Identity & Access Management (`src/core/entities/user.ts`)**:
   - Enforces a precise role hierarchy (`ANONYMOUS`, `AUTHENTICATED`, `APPRENTICE`, `STAFF`, `ADMIN`).

### Opportunity for "System Help":
- **Metadata Tags**: Introducing a `help_id` or `user_intent` tag in chapter frontmatter will allow the search engine to match user queries like "How do I set up my referral QR code?" directly to the relevant help chapter.
- **Route Sync**: The content strategy will align chapter slugs with common help routes (e.g., `/docs/pipeline`, `/docs/deals`, `/docs/affiliates`).

## 5. Critical Issues
- **Book VII Numbering**: Currently refers to itself as Book X.
- **Dead Links**: Cross-book links use relative paths that will break during consolidation. A link-checker run is required.
