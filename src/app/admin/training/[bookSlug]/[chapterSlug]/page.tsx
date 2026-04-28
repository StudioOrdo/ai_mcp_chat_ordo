import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminSection } from "@/components/admin/AdminSection";
import { requireStaffOrAdmin } from "@/lib/journal/admin-journal";
import { getCorpusRepository } from "@/adapters/RepositoryFactory";
import { canUserAccessAudience } from "@/lib/access/content-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training Chapter",
  robots: { index: false, follow: false },
};

const TRAINING_CLASSES = new Set(["manual", "training"]);

export default async function AdminTrainingChapterPage({
  params,
}: {
  params: Promise<{ bookSlug: string; chapterSlug: string }>;
}) {
  const user = await requireStaffOrAdmin();
  const primaryRole = user.roles[0];
  const { bookSlug, chapterSlug } = await params;
  const decodedBook = decodeURIComponent(bookSlug);
  const decodedChapter = decodeURIComponent(chapterSlug);

  const corpus = getCorpusRepository();
  const book = await corpus.getDocument(decodedBook);

  if (!book || !book.class || !TRAINING_CLASSES.has(book.class)) {
    notFound();
  }

  if (!canUserAccessAudience({ audience: book.audience, role: primaryRole, tier: user.tier })) {
    notFound();
  }

  let section;
  try {
    section = await corpus.getSection(decodedBook, decodedChapter);
  } catch {
    notFound();
  }

  if (!canUserAccessAudience({ audience: section.audience, role: primaryRole, tier: user.tier })) {
    notFound();
  }

  return (
    <AdminSection
      title={section.title}
      description={`${book.title} · audience: ${section.audience}${section.contentClass ? ` · class: ${section.contentClass}` : ""}`}
    >
      <div className="admin-route-stack">
        <div className="px-(--space-inset-panel)">
          <Link
            href={`/admin/training/${encodeURIComponent(decodedBook)}`}
            className="text-xs text-foreground/50 hover:text-foreground/80"
          >
            ← {book.title}
          </Link>
        </div>
        <article className="px-(--space-inset-panel)">
          <pre className="whitespace-pre-wrap wrap-break-word rounded-xl border border-foreground/8 bg-foreground/2 p-(--space-inset-panel) text-sm leading-relaxed text-foreground">
            {section.content}
          </pre>
          {section.contributors.length > 0 && (
            <section className="mt-(--space-3)">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Contributors
              </h3>
              <ul className="mt-(--space-1) flex flex-wrap gap-(--space-1) text-xs text-foreground/70">
                {section.contributors.map((contributor) => (
                  <li key={contributor} className="rounded bg-foreground/6 px-2 py-0.5">
                    {contributor}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {section.supplements.length > 0 && (
            <section className="mt-(--space-3)">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Checklist / Supplements
              </h3>
              <ul className="mt-(--space-1) list-disc space-y-(--space-1) pl-5 text-xs text-foreground/70">
                {section.supplements.map((supplement) => (
                  <li key={supplement}>{supplement}</li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </AdminSection>
  );
}
