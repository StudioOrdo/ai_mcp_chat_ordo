import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActivityReadModel } from "@/adapters/RepositoryFactory";
import { ActivityWorkspace } from "@/components/activity/ActivityWorkspace";
import { getSessionUser } from "@/lib/auth";
import {
  ACTIVITY_BUCKETS,
  isActivitySourceKind,
  type ActivityBucket,
  type ActivitySourceKind,
} from "@/lib/activity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity",
  robots: { index: false, follow: false },
};

interface ActivityPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBucket(value: string | undefined): ActivityBucket | undefined {
  if (!value) {
    return undefined;
  }

  return (ACTIVITY_BUCKETS as readonly string[]).includes(value)
    ? value as ActivityBucket
    : undefined;
}

function parseSourceKind(value: string | undefined): ActivitySourceKind | undefined {
  if (!value) {
    return undefined;
  }

  return isActivitySourceKind(value) ? value : undefined;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps = {}) {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const rawSearchParams = searchParams ? await searchParams : {};
  const bucket = parseBucket(firstParam(rawSearchParams.bucket));
  const sourceKind = parseSourceKind(firstParam(rawSearchParams.sourceKind));
  const page = parsePage(firstParam(rawSearchParams.page));
  const q = firstParam(rawSearchParams.q)?.trim() || undefined;
  const includeDismissed = firstParam(rawSearchParams.includeDismissed) === "true";
  const inbox = firstParam(rawSearchParams.inbox) === "true";
  const query = {
    bucket,
    sourceKind,
    page,
    limit: 20,
    q,
    includeDismissed,
  };
  const activityReadModel = getActivityReadModel();
  const result = inbox
    ? await activityReadModel.listUserInboxActivity(user.id, query)
    : await activityReadModel.listUserActivity(user.id, query);
  const unreadCount = "unreadCount" in result && typeof result.unreadCount === "number"
    ? result.unreadCount
    : undefined;

  return (
    <section className="min-h-full bg-background" data-activity-ledger="true" aria-label="Activity ledger">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-(--space-4) px-(--space-3) py-(--space-4) sm:px-(--space-4) lg:py-(--space-6)">
        <header>
          <p className="text-[0.68rem] font-semibold uppercase text-foreground/46">Activity</p>
          <h1 className="mt-(--space-2) text-[1.55rem] font-semibold leading-tight text-foreground sm:text-[1.9rem]">
            Full activity ledger
          </h1>
          <p className="mt-(--space-2) max-w-2xl text-sm leading-6 text-foreground/66">
            Durable work, outputs, and business milestones visible to this account.
          </p>
        </header>

        <ActivityWorkspace
          initialResult={{
            items: result.items,
            pageInfo: result.pageInfo,
            unreadCount,
          }}
          query={{
            bucket,
            sourceKind,
            q,
            page,
            includeDismissed,
            inbox,
          }}
        />
      </div>
    </section>
  );
}
