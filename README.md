# Ordo

Ordo is a local web app for one-person businesses.

You talk to it in chat. Behind the chat, Ordo can remember context, start work,
track progress, keep evidence, and return files or answers back to the same
conversation.

The project is still being built. The goal is a July 31, 2026 alpha that is
useful for real QA, real demos, and real operator feedback.

## What Ordo Is For

Small expert businesses often have the same problem:

- the owner knows what needs to happen;
- the work is spread across chat, files, tools, notes, and follow-ups;
- important context gets lost;
- automation runs without enough proof or review.

Ordo is built around a simple loop:

1. The person decides what matters.
2. Ordo helps turn that into work.
3. The system keeps records of what happened.
4. Results come back with enough evidence to trust or fix them.

## What Works Today

The repo already includes working foundations for:

- chat for public and signed-in users;
- a capability and tool registry;
- background jobs and job events;
- factory-style work orders;
- QA reports;
- media work with browser/WASM FFmpeg support;
- local search with keyword and vector retrieval;
- SQLite storage under `.data`;
- backup and native command foundations;
- Rust crates for backup and daemon work.

This does **not** mean the product is finished. It means the core pieces are in
place and being shaped into a cleaner alpha.

For the current status, read [docs/state-of-the-project.md](docs/state-of-the-project.md).

## How To Read The Docs

Start here:

- [Docs Index](docs/README.md): the map of the repo docs.
- [State Of The Project](docs/state-of-the-project.md): what is real, what is
  in progress, and what is still a plan.
- [Business Docs](docs/_business/README.md): why Ordo exists and how the work
  should be judged.
- [Contributing](CONTRIBUTING.md): how to file useful issues.

Some docs are old notes or future ideas. When something matters, trust the
current code, tests, and state-of-project page first.

## GitHub Work Process

The project is moving away from private markdown phase files as the main work
queue.

The new process is:

- use GitHub issues for visible reports and accepted work;
- use pull requests for code, tests, screenshots, and evidence;
- keep the business and UX docs as the product guide;
- keep old notes in the archive.

The process is described in
[docs/_business/08_software_manufacturing_loop.md](docs/_business/08_software_manufacturing_loop.md).

## Run Locally

Requirements:

- Node.js 22.22.2;
- npm 10 or 11;
- a local env file based on `.env.example`;
- an AI provider key if you want chat to answer with a model;
- Docker only if you want the container path.

Install and run:

```bash
npm install
cp .env.example .env.local
npm run native:check
npm run dev
```

Open:

```text
http://localhost:3000
```

If Node changed after install:

```bash
npm rebuild better-sqlite3
npm run native:check
```

## Useful Commands

```bash
npm run typecheck
npm test
npm run lint
npm run lint:css
npm run build
npm run check
npm run rust:check
```

`npm run check` runs the main local quality chain.

## Docker

Quick start:

```bash
docker run -p 80:3000 kaw393939/studioordo
```

Use a named volume for local data:

```bash
docker volume create studioordo-data
docker run -p 80:3000 -v studioordo-data:/app/.data kaw393939/studioordo
```

For local Compose:

```bash
cp .env.example .env
docker compose up --build
```

## License

Ordo is licensed under [AGPL-3.0-only](LICENSE).

The Studio Ordo GitHub organization is the planned public home for this work.
The repo is still being aligned before that cutover is treated as complete.
