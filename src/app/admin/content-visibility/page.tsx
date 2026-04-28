import type { Metadata } from "next";

import { AdminSection } from "@/components/admin/AdminSection";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { getCorpusRepository } from "@/adapters/RepositoryFactory";
import { canAccessAudience, type ContentAudience } from "@/lib/access/content-access";
import type { RoleName } from "@/core/entities/user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Content Visibility Audit",
  robots: { index: false, follow: false },
};

const ROLE_COLUMNS: RoleName[] = [
  "ANONYMOUS",
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
];

const AUDIENCES: ContentAudience[] = [
  "public",
  "account",
  "premium",
  "apprentice",
  "staff",
  "admin",
];

interface BookVisibility {
  slug: string;
  title: string;
  audience: ContentAudience;
  contentClass: string;
  totalSections: number;
  /** Sections visible per role (role is primary, no tier widening applied). */
  sectionCountByRole: Record<RoleName, number>;
  /** True when the book declares audience=X but zero sections are readable at role X. */
  drift: boolean;
  driftReason: string | null;
}

function detectDrift(book: BookVisibility): { drift: boolean; reason: string | null } {
  const bookAudience = book.audience;
  // A book declared `public` but reachable by zero ANONYMOUS users is drift.
  if (bookAudience === "public" && book.sectionCountByRole.ANONYMOUS === 0) {
    return { drift: true, reason: "declared 'public' but no sections visible to ANONYMOUS" };
  }
  if (bookAudience === "account" && book.sectionCountByRole.AUTHENTICATED === 0) {
    return { drift: true, reason: "declared 'account' but no sections visible to AUTHENTICATED" };
  }
  if (bookAudience === "apprentice" && book.sectionCountByRole.APPRENTICE === 0) {
    return { drift: true, reason: "declared 'apprentice' but no sections visible to APPRENTICE" };
  }
  if (bookAudience === "staff" && book.sectionCountByRole.STAFF === 0) {
    return { drift: true, reason: "declared 'staff' but no sections visible to STAFF" };
  }
  if (book.totalSections === 0) {
    return { drift: true, reason: "book has zero sections" };
  }
  return { drift: false, reason: null };
}

export default async function AdminContentVisibilityPage() {
  await requireAdminPageAccess();

  const corpus = getCorpusRepository();
  const [documents, sections] = await Promise.all([
    corpus.getAllDocuments(),
    corpus.getAllSections(),
  ]);

  const sectionsByBook = new Map<string, typeof sections>();
  for (const section of sections) {
    const existing = sectionsByBook.get(section.documentSlug) ?? [];
    existing.push(section);
    sectionsByBook.set(section.documentSlug, existing);
  }

  const rows: BookVisibility[] = documents.map((book) => {
    const bookSections = sectionsByBook.get(book.slug) ?? [];
    const sectionCountByRole = Object.fromEntries(
      ROLE_COLUMNS.map((role) => [
        role,
        bookSections.filter((section) => canAccessAudience(section.audience, role)).length,
      ]),
    ) as Record<RoleName, number>;

    const base: BookVisibility = {
      slug: book.slug,
      title: book.title,
      audience: book.audience,
      contentClass: book.class ?? "—",
      totalSections: bookSections.length,
      sectionCountByRole,
      drift: false,
      driftReason: null,
    };
    const { drift, reason } = detectDrift(base);
    return { ...base, drift, driftReason: reason };
  });

  const driftCount = rows.filter((row) => row.drift).length;

  // Also summarize audience coverage across the whole corpus.
  const audienceTotals: Record<ContentAudience, number> = Object.fromEntries(
    AUDIENCES.map((audience) => [
      audience,
      sections.filter((section) => section.audience === audience).length,
    ]),
  ) as Record<ContentAudience, number>;

  return (
    <AdminSection
      title="Content Visibility Audit"
      description="Corpus-wide audit of audience labels versus actual role reachability. Drift means an audience label does not match who can read the content."
    >
      <div className="admin-route-stack px-(--space-inset-panel)">
        {/* ── Summary strip ── */}
        <section className="admin-panel-surface rounded-xl p-(--space-inset-panel)">
          <h2 className="text-sm font-semibold text-foreground/60">Summary</h2>
          <div className="mt-(--space-2) grid grid-cols-2 gap-(--space-3) sm:grid-cols-4">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">
                {documents.length}
              </div>
              <div className="text-xs text-foreground/50">books</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">
                {sections.length}
              </div>
              <div className="text-xs text-foreground/50">sections</div>
            </div>
            <div>
              <div className={`text-2xl font-semibold tabular-nums ${driftCount === 0 ? "text-foreground" : "text-amber-600"}`}>
                {driftCount}
              </div>
              <div className="text-xs text-foreground/50">books with drift</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">
                {rows.filter((row) => row.contentClass && row.contentClass !== "—").length}
              </div>
              <div className="text-xs text-foreground/50">books with class label</div>
            </div>
          </div>
          <div className="mt-(--space-3) grid grid-cols-2 gap-(--space-2) sm:grid-cols-6">
            {AUDIENCES.map((audience) => (
              <div key={audience} className="rounded-lg border border-foreground/8 p-(--space-2)">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground/50">
                  {audience}
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {audienceTotals[audience]}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Per-book grid ── */}
        {rows.length === 0 ? (
          <AdminEmptyState heading="No corpus documents" description="No books were discovered." />
        ) : (
          <section className="admin-panel-surface rounded-xl p-(--space-inset-panel)">
            <h2 className="text-sm font-semibold text-foreground/60">Per-book visibility</h2>
            <div className="mt-(--space-3) overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-foreground/10 text-foreground/50">
                    <th className="py-2 pr-3 font-semibold">Book</th>
                    <th className="py-2 pr-3 font-semibold">Class</th>
                    <th className="py-2 pr-3 font-semibold">Audience</th>
                    <th className="py-2 pr-3 text-right font-semibold tabular-nums">Total</th>
                    {ROLE_COLUMNS.map((role) => (
                      <th key={role} className="py-2 pr-3 text-right font-semibold tabular-nums">
                        {role}
                      </th>
                    ))}
                    <th className="py-2 pl-3 font-semibold">Drift</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.slug} className={`border-b border-foreground/5 ${row.drift ? "bg-amber-500/5" : ""}`}>
                      <td className="py-2 pr-3 font-medium text-foreground">{row.title}</td>
                      <td className="py-2 pr-3 text-foreground/60">{row.contentClass}</td>
                      <td className="py-2 pr-3">
                        <span className="rounded bg-foreground/6 px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em] text-foreground/60">
                          {row.audience}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-foreground/70">{row.totalSections}</td>
                      {ROLE_COLUMNS.map((role) => (
                        <td
                          key={role}
                          className={`py-2 pr-3 text-right tabular-nums ${
                            row.sectionCountByRole[role] === 0
                              ? "text-foreground/30"
                              : "text-foreground"
                          }`}
                        >
                          {row.sectionCountByRole[role]}
                        </td>
                      ))}
                      <td className="py-2 pl-3">
                        {row.drift ? (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-amber-700">
                            {row.driftReason}
                          </span>
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminSection>
  );
}
