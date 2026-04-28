export function isSyntheticBrowserJobId(jobId: string): boolean {
  return jobId.startsWith("browser:");
}

export async function postJobAction(jobId: string, operation: string) {
  if (isSyntheticBrowserJobId(jobId)) {
    return { job: undefined };
  }

  const response = await fetch(`/api/chat/jobs/${encodeURIComponent(jobId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: operation }),
  });

  if (!response.ok) {
    throw new Error("Job action failed.");
  }

  return response.json() as Promise<{ job?: { conversationId?: string } }>;
}

export function resolveExternalActionUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return new URL(trimmed, window.location.origin).toString();
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
