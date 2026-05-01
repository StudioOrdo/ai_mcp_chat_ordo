import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  getBlogAssetRepository,
  getBlogPostRepository,
  getBlogPostRevisionRepository,
  getJournalEditorialMutationRepository,
  getJobStatusQuery,
} from "@/adapters/RepositoryFactory";
import {
  getBlogArticleProductionService,
  getBlogImageGenerationService,
} from "@/lib/blog/blog-production-root";
import { JournalEditorialInteractor } from "@/core/use-cases/JournalEditorialInteractor";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

export const BLOG_BUNDLE = createCatalogBoundToolBundle(
  "blog",
  "Blog Tools",
);

export function registerBlogTools(registry: ToolRegistry): void {
  const blogRepo = getBlogPostRepository();
  const blogAssetRepo = getBlogAssetRepository();
  const blogRevisionRepo = getBlogPostRevisionRepository();
  const blogArticleService = getBlogArticleProductionService();
  const blogImageService = getBlogImageGenerationService();
  const jobStatusQuery = getJobStatusQuery();
  const journalEditorialInteractor = new JournalEditorialInteractor(
    blogRepo,
    blogRevisionRepo,
    getJournalEditorialMutationRepository(),
  );

  registerCatalogBoundToolBundle(registry, "blog", {
    blogRepo,
    blogAssetRepo,
    blogRevisionRepo,
    blogArticleService,
    blogImageService,
    jobStatusQuery,
    journalEditorialInteractor,
  }, (toolName, deps) => {
    switch (toolName) {
      case "approve_journal_post":
      case "restore_journal_revision":
      case "submit_journal_review":
      case "update_journal_draft":
      case "update_journal_metadata":
        return { journalEditorialInteractor: deps.journalEditorialInteractor };
      case "compose_blog_article":
      case "generate_blog_image_prompt":
      case "produce_blog_article":
      case "qa_blog_article":
      case "resolve_blog_article_qa":
        return { blogArticleService: deps.blogArticleService };
      case "draft_content":
      case "publish_content":
        return { blogRepo: deps.blogRepo, blogAssetRepo: deps.blogAssetRepo };
      case "generate_blog_image":
      case "select_journal_hero_image":
        return { blogImageService: deps.blogImageService };
      case "get_journal_post":
      case "list_journal_posts":
        return { blogRepo: deps.blogRepo };
      case "get_journal_workflow_summary":
        return { blogRepo: deps.blogRepo, jobStatusQuery: deps.jobStatusQuery };
      case "list_journal_revisions":
        return { blogRepo: deps.blogRepo, blogRevisionRepo: deps.blogRevisionRepo };
      case "prepare_journal_post_for_publish":
        return {
          blogRepo: deps.blogRepo,
          blogRevisionRepo: deps.blogRevisionRepo,
          jobStatusQuery: deps.jobStatusQuery,
          blogArticleService: deps.blogArticleService,
        };
      case "publish_journal_post":
        return {
          blogRepo: deps.blogRepo,
          blogRevisionRepo: deps.blogRevisionRepo,
          blogAssetRepo: deps.blogAssetRepo,
        };
      default:
        return {};
    }
  });
}
