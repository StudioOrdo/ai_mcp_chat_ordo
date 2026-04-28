import type { Metadata } from "next";
import Link from "next/link";

import { AdminSection } from "@/components/admin/AdminSection";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { requireStaffOrAdmin } from "@/lib/journal/admin-journal";
import { getCorpusRepository } from "@/adapters/RepositoryFactory";
import { canUserAccessAudience } from "@/lib/access/content-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Training",
  robots: { index: false, follow: false },
};

const TRAINING_CLASSES = new Set(["manual", "training"]);

export default async function AdminTrainingIndexPage() {
  const user = await requireStaffOrAdmin();
  const primaryRole = user.roles[0];

  const corpus = getCorpusRepository();
  const [documents, sections] = await Promise.all([
    corpus.getAllDocuments(),
    corpus.getAllSections(),
  ]);

  const trainingBooks = documents
    .filter((doc) => doc.class && TRAINING_CLASSES.has(doc.class))
    .filter((doc) =>
      canUserAccessAudience({ audience: doc.audience, role: primaryRole, tier: user.tier }),
    );

  const chapterCountBySlug = new Map<string, number>();
  for (const section of sections) {
    chapterCountBySlug.set(
      section.documentSlug,
      (chapterCountBySlug.get(section.documentSlug) ?? 0) + 1,
    );
  }

  return (
    <AdminSection
      title="Training"
      description="Operator manuals and onboarding paths sourced from the editorial corpus. Visibility is governed by audience, not role."
    >
      <div className="admin-route-stack">
        {trainingBooks.length === 0 ? (
          <AdminEmptyState
            heading="No training books visible"
            description="No corpus documents with class 'manual' or 'training' are currently available to this viewer."
          />
        ) : (
          <div className="grid gap-(--space-3) sm:grid-cols-2 lg:grid-cols-3">
            {trainingBooks.map((book) => (
              <Link
                key={book.slug}
                href={`/admin/training/${encodeURIComponent(book.slug)}`}
                className="admin-panel-surface group rounded-xl p-(--space-inset-default) transition hover:border-foreground/16 hover:shadow-sm sm:p-(--space-inset-panel)"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-amber-600">
                    {book.class}
                  </span>
                  <span className="text-xs text-foreground/40">
                    {chapterCountBySlug.get(book.slug) ?? 0} chapter
                    {(chapterCountBySlug.get(book.slug) ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
                <h2 className="mt-(--space-2) text-sm font-semibold text-foreground">{book.title}</h2>
                <div className="mt-(--space-1) flex items-center gap-(--space-2) text-xs text-foreground/50">
                  <span className="rounded bg-foreground/6 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-foreground/60">
                    {book.audience}
                  </span>
                  {book.rolePersona && (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-sky-600">
                      {book.rolePersona}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminSection>
  );
}
