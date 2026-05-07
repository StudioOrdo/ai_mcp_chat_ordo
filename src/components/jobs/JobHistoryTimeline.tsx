import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";

import {
  formatJobHistoryEntry,
  formatJobTimestamp,
  getStatusTone,
  STATUS_LABELS,
} from "@/components/jobs/job-workspace-helpers";

interface JobHistoryTimelineProps {
  events: JobHistoryEntry[];
}

export function JobHistoryTimeline({ events }: JobHistoryTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="jobs-empty-state px-(--space-4) py-(--space-6) text-sm text-foreground/55">
        No durable history yet for this job.
      </div>
    );
  }

  return (
    <ol className="space-y-(--space-3)" data-testid="job-history-timeline">
      {events.map((event) => (
        <li key={event.id} className="jobs-event-item px-(--space-4) py-(--space-4)">
          <div className="flex flex-wrap items-center gap-(--space-2)">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase ${getStatusTone(event.part.status)}`}>
              {STATUS_LABELS[event.part.status]}
            </span>
            <span className="text-xs uppercase text-foreground/45">Sequence {event.sequence}</span>
            <span className="text-xs text-foreground/45">{formatJobTimestamp(event.createdAt)}</span>
          </div>
          <p className="mt-(--space-2) text-sm leading-6 text-foreground/72">{formatJobHistoryEntry(event)}</p>
        </li>
      ))}
    </ol>
  );
}
