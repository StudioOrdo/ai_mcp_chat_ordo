# Ordo Content Strategy: The Sovereign Solopreneur

## 1. The Solopreneur Narrative
The primary goal of the Ordo Corpus is to transform the user from a passive consumer of AI into a **Sovereign Solopreneur**. 

This narrative follows three movements:
1.  **Awakening (The 2nd Renaissance)**: Understanding the economic imperative to own one's inference.
2.  **Formation (The Identity & Signal)**: Building the personal infrastructure (archetype, thesis, proof) to be legible to the market.
3.  **Operation (The System)**: Deploying the technical infrastructure (Studio Ordo) to run a capital-efficient, AI-native business.

## 2. Consolidation Map (The 5 Volumes)

We are retiring the "11-Book" model in favor of a "5-Volume" Knowledge Base.

### Volume I: The Renaissance Thesis
- **Chapters**: Why Now, Political Economy of Skills, Symbolic Scarcity, The Forward Deployed Profile.
- **Narrative**: High-level context and historical grounding.

### Volume II: Identity & Persona
- **Chapters**: The Master Model, Archetype Design, The Portfolio as Signal.
- **Narrative**: Defining the "Who" behind the business.

### Volume III: The Market Signal
- **Chapters**: Trust & Proof, Visual Intelligence, Persuasion, Strategic Deployment.
- **Narrative**: Making the identity visible and irrefutable.

### Volume IV: The Solopreneur System (Operational Manual)
- **Chapters**: Studio Ordo Architecture, Managing the Deal CRM Pipeline, Maximizing the Affiliate & Referral System, AI Project Management, Governance.
- **Narrative**: How to actually run the software that powers the Solopreneur's business—from generating personal affiliate QR codes, to tracking the deal lifecycle, up to advanced AI project management.

### Volume V: The Formation Process
- **Chapters**: Whole-Person Formation, The Trivium/Quadrivium model, The Artifact Ladder.
- **Narrative**: Continuous growth and long-term sovereignty.

## 3. The "System-Native Help" Architecture

To build "Help" for the users, we will treat the corpus as a **Sovereign Help Engine**.

### 3.1 Metadata Requirements
Every chapter must contain frontmatter metadata for the search indexer:
```yaml
---
title: "The Solopreneur Setup"
help_id: "setup-studio-ordo"
user_intent: ["installing docker", "running ordo locally", "setup troubleshooting"]
tags: ["operational", "technical"]
---
```

### 3.2 Integrated Routes
Content will be structured to support the system's "Route Aliasing":
- `/library/setup` -> Maps to `Vol IV, Ch 2`
- `/library/archetypes` -> Maps to `Vol II, Chapters 3-10`

### 3.3 The AI Assistant Policy
The assistant's prompt (`src/lib/corpus-vocabulary.ts`) will be updated to:
- Favor "Help" tagged content when the user asks "How do I...?"
- Cite Volume/Chapter rather than Book/Chapter.
- Use the **Solopreneur** terminology exclusively.

## 4. Phased Roadmap

- **Phase 1 (Weeks 1-2)**: Terminology standardization (The "Search/Replace" phase).
- **Phase 2 (Weeks 3-4)**: Folder restructuring and link refactoring (The "Consolidation" phase).
- **Phase 3 (Weeks 5-6)**: Metadata enrichment and Search calibration (The "System Help" phase).
