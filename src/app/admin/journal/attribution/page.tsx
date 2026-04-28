import type { Metadata } from "next";

import { AdminBrowseFilters } from "@/components/admin/AdminBrowseFilters";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminSection } from "@/components/admin/AdminSection";
import { loadJournalAttribution } from "@/lib/admin/attribution/admin-attribution";
import { requireJournalWorkspaceAccess } from "@/lib/journal/admin-journal";
import {
  getAdminJournalDetailPath,
} from "@/lib/journal/admin-journal-routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Content Attribution — Admin",
  robots: { index: false, follow: false },
};

export default async function AttributionPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string; before?: string }>;
}) {
  await requireJournalWorkspaceAccess();
  const params = await searchParams;

  const now = new Date();
  const defaultAfter = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  const afterDate = params.after ?? defaultAfter;
  const beforeDate = params.before;

  const entries = await loadJournalAttribution({
    afterDate,
    beforeDate,
  });

  const totals = entries.reduce(
    (acc, e) => ({
      conversations: acc.conversations + e.conversationsSourced,
      leads: acc.leads + e.leadsGenerated,
      deals: acc.deals + e.dealsGenerated,
      revenue: acc.revenue + e.estimatedRevenue,
    }),
    { conversations: 0, leads: 0, deals: 0, revenue: 0 },
  );

  return (
    <AdminSection
      title="Content Attribution"
      description="See how journal articles drive conversations, leads, and revenue through the AI concierge."
    >
      <div className="admin-route-stack">
        <AdminBrowseFilters
          fields={[
            { name: "after", label: "After", type: "date" },
            { name: "before", label: "Before", type: "date" },
          ]}
          values={{ after: afterDate, before: beforeDate ?? "" }}
        />

        {entries.length === 0 ? (
          <AdminEmptyState
            heading="No attribution data yet"
            description="Publish articles and share them — attribution data appears as visitors convert through the AI concierge."
          />
        ) : (
          <div className="admin-scroll-shell" data-admin-scroll-shell="journal-attribution">
            <table className="admin-scroll-table admin-scroll-table-wide w-full text-sm" data-admin-attribution-table="true">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  <th scope="col" className="px-(--space-inset-compact) py-(--space-2)">Article</th>
                  <th scope="col" className="px-(--space-inset-compact) py-(--space-2)">Published</th>
                  <th scope="col" className="px-(--space-inset-compact) py-(--space-2) text-right">Conversations</th>
                  <th scope="col" className="px-(--space-inset-compact) py-(--space-2) text-right">Leads</th>
                  <th scope="col" className="px-(--space-inset-compact) py-(--space-2) text-right">Deals</th>
                  <th scope="col" className="px-(--space-inset-compact) py-(--space-2) text-right">Est. Revenue</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.postId} className="border-b border-foreground/6">
                    <td className="px-(--space-inset-compact) py-(--space-2)">
                      <a href={getAdminJournalDetailPath(entry.postId)} className="font-medium text-foreground underline-offset-4 hover:underline">
                        {entry.postTitle}
                      </a>
                    </td>
                    <td className="px-(--space-inset-compact) py-(--space-2) text-foreground/60">
                      {entry.publishedAt?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-(--space-inset-compact) py-(--space-2) text-right tabular-nums">{entry.conversationsSourced}</td>
                    <td className="px-(--space-inset-compact) py-(--space-2) text-right tabular-nums">{entry.leadsGenerated}</td>
                    <td className="px-(--space-inset-compact) py-(--space-2) text-right tabular-nums">{entry.dealsGenerated}</td>
                    <td className="px-(--space-inset-compact) py-(--space-2) text-right tabular-nums">
                      {entry.estimatedRevenue > 0 ? `$${entry.estimatedRevenue.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-foreground/16 font-semibold">
                  <td className="px-(--space-inset-compact) py-(--space-2)" colSpan={2}>Total</td>
                  <td className="px-(--space-inset-compact) py-(--space-2) text-right tabular-nums">{totals.conversations}</td>
                  <td className="px-(--space-inset-compact) py-(--space-2) text-right tabular-nums">{totals.leads}</td>
                  <td className="px-(--space-inset-compact) py-(--space-2) text-right tabular-nums">{totals.deals}</td>
                  <td className="px-(--space-inset-compact) py-(--space-2) text-right tabular-nums">
                    {totals.revenue > 0 ? `$${totals.revenue.toLocaleString()}` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
