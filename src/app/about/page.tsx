import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | Studio Ordo",
  description:
    "Studio Ordo is an open-source AI operator platform for solopreneurs. Self-hosted, GPL-3 licensed, and built to grow with your business.",
};

export default function AboutPage() {
  return (
    <main className="shell-page editorial-page-shell">
      <div className="site-container px-(--container-padding) py-[clamp(3rem,8vw,6rem)]">

        {/* Hero */}
        <section className="mb-[clamp(3rem,8vw,5rem)] max-w-3xl">
          <p className="shell-section-heading opacity-60 mb-4">About Studio Ordo</p>
          <h1 className="journal-intro-title mb-6">
            Run your business like you have a team.
          </h1>
          <p className="journal-intro-dek mb-3">
            Because now you do. Studio Ordo is an open-source AI operator platform designed for solopreneurs who want the capability of a full operation — without hiring one.
          </p>
          <p className="journal-intro-dek">
            Chat, search, workflows, publishing, and media composition. All in one system. All on infrastructure you own.
          </p>
        </section>

        <hr className="border-t border-color-theme mb-[clamp(3rem,8vw,5rem)]" />

        {/* What makes it different */}
        <section className="mb-[clamp(3rem,8vw,5rem)]">
          <h2 className="shell-panel-heading mb-8">What makes Ordo different</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="about-feature-card">
              <p className="about-feature-title">You own it outright</p>
              <p className="about-feature-body">
                GPL-3 licensed. Self-hosted. Your data never touches our servers because we don&rsquo;t have any. Deploy once, run forever.
              </p>
            </div>
            <div className="about-feature-card">
              <p className="about-feature-title">AI that actually operates</p>
              <p className="about-feature-body">
                Ordo&rsquo;s AI doesn&rsquo;t just chat — it executes. Generate media, run background jobs, search your knowledge base, manage your publishing pipeline. All from a single conversation.
              </p>
            </div>
            <div className="about-feature-card">
              <p className="about-feature-title">Grows with your business</p>
              <p className="about-feature-body">
                Start solo. Bring on contractors as Apprentices. Add team members as Staff. Your platform scales with you — same system, more people, full access control.
              </p>
            </div>
            <div className="about-feature-card">
              <p className="about-feature-title">Generative UI</p>
              <p className="about-feature-body">
                The chat interface renders interactive components — charts, media previews, job progress, and more — based on what the AI is actually doing. Not just text.
              </p>
            </div>
            <div className="about-feature-card">
              <p className="about-feature-title">Hybrid search + memory</p>
              <p className="about-feature-body">
                A built-in knowledge base combines BM25 keyword search with semantic vector search. Your AI librarian reads, writes, and remembers across your entire corpus.
              </p>
            </div>
            <div className="about-feature-card">
              <p className="about-feature-title">MCP-native extensibility</p>
              <p className="about-feature-body">
                Ordo is both an MCP host and an MCP server. Connect local models, external agents, or custom binary tools — all governed by the same capability catalog.
              </p>
            </div>
          </div>
        </section>

        <hr className="border-t border-color-theme mb-[clamp(3rem,8vw,5rem)]" />

        {/* How it works */}
        <section className="mb-[clamp(3rem,8vw,5rem)] max-w-2xl">
          <h2 className="shell-panel-heading mb-6">How it works</h2>
          <div className="space-y-6">
            <div className="about-step">
              <span className="about-step-number">01</span>
              <div>
                <p className="about-step-title">Deploy in minutes</p>
                <p className="about-step-body">Pull the Docker image, mount your config, set your API keys. Your instance is running on your own server — VPS, home lab, or cloud VM.</p>
              </div>
            </div>
            <div className="about-step">
              <span className="about-step-number">02</span>
              <div>
                <p className="about-step-title">Configure your identity</p>
                <p className="about-step-body">A single <code className="about-code">config/identity.json</code> file sets your brand, name, tagline, and social links. White-label ready from day one.</p>
              </div>
            </div>
            <div className="about-step">
              <span className="about-step-number">03</span>
              <div>
                <p className="about-step-title">Operate your business</p>
                <p className="about-step-body">Chat with your AI operator, publish to your journal, run media jobs, manage leads, and search your knowledge base — all in one governed workspace.</p>
              </div>
            </div>
            <div className="about-step">
              <span className="about-step-number">04</span>
              <div>
                <p className="about-step-title">Invite your team</p>
                <p className="about-step-body">When you&rsquo;re ready, add team members with scoped roles. Staff see what they need. Admins control everything. No new platform required.</p>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-t border-color-theme mb-[clamp(3rem,8vw,5rem)]" />

        {/* Open source */}
        <section className="mb-[clamp(3rem,8vw,5rem)] max-w-2xl">
          <h2 className="shell-panel-heading mb-4">Built in the open</h2>
          <p className="journal-intro-dek mb-6">
            Studio Ordo is released under the GNU GPL-3 license. That means you can run it, study it, modify it, and share it — freely. Companies who build on it must contribute back. The code is yours.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/studioordo"
              target="_blank"
              rel="noopener noreferrer"
              className="shell-nav-guest-link shell-nav-guest-link-primary px-5"
            >
              View on GitHub
            </a>
            <a
              href="https://www.youtube.com/@studioordo"
              target="_blank"
              rel="noopener noreferrer"
              className="shell-nav-guest-link shell-nav-guest-link-secondary px-5"
            >
              Watch on YouTube
            </a>
          </div>
        </section>

        <hr className="border-t border-color-theme mb-[clamp(3rem,8vw,5rem)]" />

        {/* CTA */}
        <section className="max-w-xl">
          <h2 className="shell-panel-heading mb-3">Ready to run your own?</h2>
          <p className="journal-intro-dek mb-6">
            Self-host Studio Ordo on any VPS in under ten minutes, or let us run it for you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="shell-nav-guest-link shell-nav-guest-link-primary px-5"
            >
              Get started
            </Link>
            <Link
              href="/library"
              className="shell-nav-guest-link shell-nav-guest-link-secondary px-5"
            >
              Explore the library
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
