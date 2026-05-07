import { getBlogPostRepository } from "@/adapters/RepositoryFactory";
import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  type ShellNavigationContext,
} from "@/lib/shell/shell-navigation";

export async function loadPublicShellNavigationContext(): Promise<ShellNavigationContext> {
  try {
    const publishedCount = await getBlogPostRepository().countPublished();

    return {
      hasPublicFeedItems: publishedCount > 0,
    };
  } catch {
    return DEFAULT_SHELL_NAVIGATION_CONTEXT;
  }
}
