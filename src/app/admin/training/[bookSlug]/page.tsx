import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminSection } from "@/components/admin/AdminSection";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { requireStaffOrAdmin } from "@/lib/journal/admin-journal";
import { getCorpusRepository } from "@/adapters/RepositoryFactory";
import { canUserAccessAudience } from "@/lib/access/content-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training Book",
  robots: { index: false, follow: false },
};

const TRAINING_CLASSES = new Set(["manual", "training"]);

export default async function AdminTrainingBookPage({
  params,
}: {
  params: Promise<{ bookSlug: string }>;
}) {
  const user = await requireStaffOrAdmin();
  const primaryRole = user.roles[0];
  const { bookSlug } = await params;
  const decodedSlug = decodeURIComponent(bookSlug);

  const corpus = getCorpusRepository();
  const book = await corpus.getDocument(decodedSlug);

  if (!book || !book.class || !TRAINING_CLASSES.has(book.class)) {
    notFound();
  }

  if (!canUserAccessAudience({ audience: book.audience, role: primaryRole, tier: user.tier })) {
    notFound();
  }

  const sections = await corpus.getSectionsByDocument(decodedSlug);
  const visibleSections = sections.filter((section) =>
    canUserAccessAudience({ audience: section.audience, role: primaryRole, tier: user.tier }),
  );

  return (
    <AdminSection
      title={book.title}
      description={`${book.class.toUpperCase()} · audience: ${book.audience}${book.rolePersona ? ` · persona: ${book.rolePersona}` : ""}`}
    >
      <div className="admin-route-stack">
        <div className="px-(--space-inset-panel)">
          <Link
            href="/admin/training"
            className="text-xs text-foreground/50 hover:text-foreground/80"
          >
            ← All training books
          </Link>
        </div>
        {visibleSections.length === 0 ? (
          <AdminEmptyState
            heading="No chapters visible"
            description="This book has no chapters visible to your role and tier."
          />
        ) : (
          <ol className="grid gap-(--space-2) px-(--space-inset-panel)">
            {visibleSections.map((section, index) => (
              <li key={section.sectionSlug}>
                <Link
                  href={`/admin/training/${encodeURIComponent(decodedSlug)}/${encodeURIComponent(section.sectionSlug)}`}
                  className="admin-panel-surface flex items-start gap-(--space-3) rounded-xl p-(--space-inset-default) transition hover:border-foreground/16 hover:shadow-sm"
                >
                  <span className="mt-0.5 text-xs font-mono text-foreground/40 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                    <div className="mt-(--space-1) flex items-center gap-(--space-2) text-xs text-foreground/50">
                      <span className="rounded bg-foreground/6 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-foreground/60">
                        {section.audience}
                      </span>
                      {section.contentClass && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-amber-600">
                          {section.contentClass}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AdminSection>
  );
}
