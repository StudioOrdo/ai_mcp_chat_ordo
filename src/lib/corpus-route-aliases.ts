import type { CorpusIndexEntry } from "@/core/use-cases/CorpusIndexInteractor";

function normalizeAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function stripChapterPrefix(slug: string): string {
  return slug.replace(/^ch\d{1,3}-/i, "");
}

function buildAliases(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (value ? normalizeAlias(value) : ""))
        .filter(Boolean),
    ),
  );
}

function manualChapterAliases(entry: CorpusIndexEntry): string[] {
  const routeKey = `${entry.bookSlug}/${entry.chapterSlug}`;

  if (routeKey === "field-guide/ch07-the-outlaw-sage") {
    return ["the-outlaw"];
  }

  return [];
}

function chapterAliases(entry: CorpusIndexEntry): string[] {
  const titleLead = entry.chapterTitle.split(":")[0] ?? entry.chapterTitle;

  return buildAliases([
    entry.chapterSlug,
    stripChapterPrefix(entry.chapterSlug),
    titleLead,
    entry.chapterTitle,
    ...manualChapterAliases(entry),
  ]);
}

function bookAliases(entry: CorpusIndexEntry): string[] {
  return buildAliases([entry.bookSlug, entry.bookTitle]);
}

function findUniqueAliasMatch(
  index: CorpusIndexEntry[],
  requestedSlug: string,
  getAliases: (entry: CorpusIndexEntry) => string[],
): CorpusIndexEntry | undefined {
  const normalizedSlug = normalizeAlias(requestedSlug);
  if (!normalizedSlug) {
    return undefined;
  }

  const matches = index.filter((entry) => getAliases(entry).includes(normalizedSlug));
  return matches.length === 1 ? matches[0] : undefined;
}

export function findCorpusChapterMatch(index: CorpusIndexEntry[], requestedSlug: string): CorpusIndexEntry | undefined {
  return findUniqueAliasMatch(index, requestedSlug, chapterAliases);
}

export function findCorpusBookMatch(index: CorpusIndexEntry[], requestedSlug: string): CorpusIndexEntry | undefined {
  return findUniqueAliasMatch(index, requestedSlug, bookAliases);
}