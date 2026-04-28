import { scrollElementIntoView } from "@/lib/ui/browserSupport";

const JOB_MESSAGE_HIGHLIGHT_CLASS = "ui-chat-message-highlight";
const JOB_MESSAGE_HIGHLIGHT_ATTR = "data-chat-job-highlight";

function escapeSelectorToken(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function getJobMessageSelector(jobId: string): string {
  return `[data-chat-job-message~="${escapeSelectorToken(jobId)}"]`;
}

export function scrollToJobMessage(
  jobId: string,
  targetDocument: Document | null = typeof document === "undefined" ? null : document,
): boolean {
  if (!jobId || !targetDocument) {
    return false;
  }

  const target = targetDocument.querySelector<HTMLElement>(getJobMessageSelector(jobId));
  if (!target) {
    return false;
  }

  scrollElementIntoView(target, "smooth", "center");
  target.classList.add(JOB_MESSAGE_HIGHLIGHT_CLASS);
  target.setAttribute(JOB_MESSAGE_HIGHLIGHT_ATTR, "true");

  window.setTimeout(() => {
    target.classList.remove(JOB_MESSAGE_HIGHLIGHT_CLASS);
    target.removeAttribute(JOB_MESSAGE_HIGHLIGHT_ATTR);
  }, 1_800);

  return true;
}