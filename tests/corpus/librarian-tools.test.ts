import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type { LibrarianToolDeps } from "@/lib/capabilities/shared/librarian-tool";
import {
  librarianList,
  librarianGetBook,
  librarianAddBook,
  librarianAddChapter,
  librarianRemoveBook,
  librarianRemoveChapter,
} from "@/lib/capabilities/shared/librarian-tool";
import type { VectorStore } from "@/core/search/ports/VectorStore";

/**
 * Sprint 1 — Librarian tool function tests.
 * Uses temp directories + InMemoryVectorStore — no real DB.
 */

// Minimal in-memory VectorStore for testing
function createMockVectorStore(): VectorStore {
  const records: Map<string, { sourceId: string }[]> = new Map();
  return {
    upsert: vi.fn(),
    delete: vi.fn((sourceId: string) => {
      records.delete(sourceId);
    }),
    getAll: vi.fn(() => []),
    getBySourceId: vi.fn((sourceId: string) =>
      (records.get(sourceId) ?? []) as ReturnType<VectorStore["getBySourceId"]>,
    ),
    searchSimilar: vi.fn(() => []),
    searchKeyword: vi.fn(() => []),
    hydrateByIds: vi.fn(() => []),
    listSourceIds: vi.fn(() => [...records.keys()]),
    getContentHash: vi.fn(() => null),
    getModelVersion: vi.fn(() => null),
    count: vi.fn(() => {
      let total = 0;
      for (const v of records.values()) total += v.length;
      return total;
    }),
    // Helper to seed test data
    _seed(sourceId: string) {
      records.set(sourceId, [{ sourceId }] as ReturnType<VectorStore["getBySourceId"]>);
    },
  } as VectorStore & { _seed: (id: string) => void };
}

let tmpDir: string;
let corpusDir: string;
let mockVectorStore: ReturnType<typeof createMockVectorStore>;
let clearCaches: ReturnType<typeof vi.fn>;
let deps: LibrarianToolDeps;

async function writeManifest(
  slug: string,
  overrides: Record<string, unknown> = {},
) {
  const bookDir = path.join(corpusDir, slug);
  await fs.mkdir(path.join(bookDir, "chapters"), { recursive: true });
  const manifest = {
    slug,
    title: `Book ${slug}`,
    number: "I",
    sortOrder: 1,
    domain: ["teaching"],
    ...overrides,
  };
  await fs.writeFile(
    path.join(bookDir, "book.json"),
    JSON.stringify(manifest),
  );
  return bookDir;
}

async function writeChapter(
  bookSlug: string,
  chapterSlug: string,
  content: string,
) {
  const chapterPath = path.join(
    corpusDir,
    bookSlug,
    "chapters",
    `${chapterSlug}.md`,
  );
  await fs.writeFile(chapterPath, content);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "librarian-tools-"));
  corpusDir = path.join(tmpDir, "_corpus");
  await fs.mkdir(corpusDir, { recursive: true });
  mockVectorStore = createMockVectorStore();
  clearCaches = vi.fn();
  deps = {
    corpusDir,
    vectorStore: mockVectorStore,
    clearCaches: clearCaches as unknown as () => void,
  };
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// librarian_list
// ---------------------------------------------------------------------------

describe("librarian_list", () => {
  it("lists empty corpus", async () => {
    const result = await librarianList(deps);
    expect(result.books).toEqual([]);
    expect(result.totalBooks).toBe(0);
    expect(result.totalChapters).toBe(0);
  });

  it("lists books with chapter counts", async () => {
    await writeManifest("alpha-book", { sortOrder: 2, title: "Alpha" });
    await writeChapter("alpha-book", "ch00-intro", "# Intro\nContent");
    await writeChapter("alpha-book", "ch01-more", "# More\nContent");

    await writeManifest("beta-book", { sortOrder: 1, title: "Beta" });
    await writeChapter("beta-book", "ch00-start", "# Start\nContent");

    // Seed embeddings for alpha so it shows as indexed
    (mockVectorStore as VectorStore & { _seed: (id: string) => void })._seed(
      "alpha-book/ch00-intro",
    );

    const result = await librarianList(deps);
    expect(result.totalBooks).toBe(2);
    expect(result.totalChapters).toBe(3);

    // Sorted by sortOrder: beta (1) before alpha (2)
    expect(result.books[0].slug).toBe("beta-book");
    expect(result.books[0].chapterCount).toBe(1);
    expect(result.books[0].indexed).toBe(false);

    expect(result.books[1].slug).toBe("alpha-book");
    expect(result.books[1].chapterCount).toBe(2);
    expect(result.books[1].indexed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// librarian_get_book
// ---------------------------------------------------------------------------

describe("librarian_get_book", () => {
  it("gets book details with chapters", async () => {
    await writeManifest("my-book", {
      title: "My Book",
      domain: ["teaching", "reference"],
      tags: ["test"],
    });
    await writeChapter("my-book", "ch00-intro", "# Introduction\nHello world.");

    const result = await librarianGetBook(deps, { slug: "my-book" });
    expect(result.slug).toBe("my-book");
    expect(result.title).toBe("My Book");
    expect(result.domain).toEqual(["teaching", "reference"]);
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].slug).toBe("ch00-intro");
    expect(result.chapters[0].title).toBe("Introduction");
    expect(result.chapters[0].contentLength).toBeGreaterThan(0);
  });

  it("throws for missing book", async () => {
    await expect(
      librarianGetBook(deps, { slug: "nonexistent" }),
    ).rejects.toThrow("Document not found");
  });
});

// ---------------------------------------------------------------------------
// librarian_add_book
// ---------------------------------------------------------------------------

describe("librarian_add_book", () => {
  it("adds book with chapters (manual)", async () => {
    const result = await librarianAddBook(deps, {
      slug: "new-book",
      title: "New Book",
      number: "XI",
      sortOrder: 11,
      domain: ["teaching"],
      tags: ["test"],
      chapters: [
        { slug: "ch00-intro", content: "# Intro\nContent here" },
        { slug: "ch01-body", content: "# Body\nMore content" },
      ],
    });

    expect(result.slug).toBe("new-book");
    expect(result.chaptersWritten).toBe(2);
    expect(result.indexed).toBe(false);

    // Verify filesystem
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(corpusDir, "new-book", "book.json"),
        "utf-8",
      ),
    );
    expect(manifest.slug).toBe("new-book");
    expect(manifest.sortOrder).toBe(11);
    expect(manifest.domain).toEqual(["teaching"]);
    expect(manifest.tags).toEqual(["test"]);

    const ch = await fs.readFile(
      path.join(corpusDir, "new-book", "chapters", "ch00-intro.md"),
      "utf-8",
    );
    expect(ch).toBe("# Intro\nContent here");
  });

  it("adds book without chapters (manual)", async () => {
    const result = await librarianAddBook(deps, {
      slug: "empty-book",
      title: "Empty Book",
      number: "XII",
      sortOrder: 12,
      domain: ["reference"],
    });

    expect(result.chaptersWritten).toBe(0);
    // chapters/ dir should still exist
    const stat = await fs.stat(
      path.join(corpusDir, "empty-book", "chapters"),
    );
    expect(stat.isDirectory()).toBe(true);
  });

  it("rejects duplicate slug", async () => {
    await writeManifest("existing-book");
    await expect(
      librarianAddBook(deps, {
        slug: "existing-book",
        title: "Dupe",
        number: "I",
        sortOrder: 1,
        domain: ["teaching"],
      }),
    ).rejects.toThrow("Document already exists");
  });

  it("rejects missing fields", async () => {
    await expect(
      librarianAddBook(deps, {
        slug: "no-title",
        title: "",
        number: "I",
        sortOrder: 1,
        domain: ["teaching"],
      }),
    ).rejects.toThrow();
  });

  it("validates sortOrder is number", async () => {
    await expect(
      librarianAddBook(deps, {
        slug: "bad-sort",
        title: "Bad Sort",
        number: "I",
        sortOrder: "not-a-number" as unknown as number,
        domain: ["teaching"],
      }),
    ).rejects.toThrow("sortOrder must be a number");
  });

  it("rejects invalid domain values", async () => {
    await expect(
      librarianAddBook(deps, {
        slug: "bad-domain",
        title: "Bad Domain",
        number: "I",
        sortOrder: 1,
        domain: ["bogus"],
      }),
    ).rejects.toThrow("Invalid domain value");
  });

  it("rejects empty domain array", async () => {
    await expect(
      librarianAddBook(deps, {
        slug: "no-domain",
        title: "No Domain",
        number: "I",
        sortOrder: 1,
        domain: [],
      }),
    ).rejects.toThrow("domain must be a non-empty array");
  });
});

// ---------------------------------------------------------------------------
// librarian_add_chapter
// ---------------------------------------------------------------------------

describe("librarian_add_chapter", () => {
  it("adds chapter to existing book", async () => {
    await writeManifest("target-book");

    const result = await librarianAddChapter(deps, {
      book_slug: "target-book",
      chapter_slug: "ch00-new",
      content: "# New Chapter\nContent",
    });

    expect(result.written).toBe(true);
    expect(clearCaches).toHaveBeenCalled();

    const content = await fs.readFile(
      path.join(corpusDir, "target-book", "chapters", "ch00-new.md"),
      "utf-8",
    );
    expect(content).toBe("# New Chapter\nContent");
  });

  it("overwrites existing chapter", async () => {
    await writeManifest("target-book");
    await writeChapter("target-book", "ch00-existing", "old content");

    await librarianAddChapter(deps, {
      book_slug: "target-book",
      chapter_slug: "ch00-existing",
      content: "new content",
    });

    const content = await fs.readFile(
      path.join(corpusDir, "target-book", "chapters", "ch00-existing.md"),
      "utf-8",
    );
    expect(content).toBe("new content");
  });

  it("rejects chapter for missing book", async () => {
    await expect(
      librarianAddChapter(deps, {
        book_slug: "nonexistent",
        chapter_slug: "ch00-test",
        content: "content",
      }),
    ).rejects.toThrow("Document not found");
  });

  it("rejects empty content", async () => {
    await writeManifest("target-book");
    await expect(
      librarianAddChapter(deps, {
        book_slug: "target-book",
        chapter_slug: "ch00-empty",
        content: "",
      }),
    ).rejects.toThrow("content must not be empty");
  });
});

// ---------------------------------------------------------------------------
// librarian_remove_book
// ---------------------------------------------------------------------------

describe("librarian_remove_book", () => {
  it("removes book and embeddings", async () => {
    await writeManifest("doomed-book");
    await writeChapter("doomed-book", "ch00-intro", "content");

    // Seed embeddings
    (mockVectorStore as VectorStore & { _seed: (id: string) => void })._seed(
      "doomed-book/ch00-intro",
    );

    const result = await librarianRemoveBook(deps, { slug: "doomed-book" });
    expect(result.slug).toBe("doomed-book");
    expect(result.chaptersRemoved).toBe(1);

    // Verify dir is gone
    await expect(
      fs.access(path.join(corpusDir, "doomed-book")),
    ).rejects.toThrow();

    // Verify vectorStore.delete was called
    expect(mockVectorStore.delete).toHaveBeenCalledWith(
      "doomed-book/ch00-intro",
    );
    expect(clearCaches).toHaveBeenCalled();
  });

  it("rejects removing missing book", async () => {
    await expect(
      librarianRemoveBook(deps, { slug: "nonexistent" }),
    ).rejects.toThrow("Document not found");
  });
});

// ---------------------------------------------------------------------------
// librarian_remove_chapter
// ---------------------------------------------------------------------------

describe("librarian_remove_chapter", () => {
  it("removes chapter and embeddings", async () => {
    await writeManifest("book-with-chapter");
    await writeChapter("book-with-chapter", "ch00-remove-me", "content");

    const result = await librarianRemoveChapter(deps, {
      book_slug: "book-with-chapter",
      chapter_slug: "ch00-remove-me",
    });

    expect(result.book_slug).toBe("book-with-chapter");
    expect(result.chapter_slug).toBe("ch00-remove-me");

    // Verify file is gone
    await expect(
      fs.access(
        path.join(
          corpusDir,
          "book-with-chapter",
          "chapters",
          "ch00-remove-me.md",
        ),
      ),
    ).rejects.toThrow();

    expect(mockVectorStore.delete).toHaveBeenCalledWith(
      "book-with-chapter/ch00-remove-me",
    );
    expect(clearCaches).toHaveBeenCalled();
  });

  it("rejects removing missing chapter", async () => {
    await writeManifest("book-with-chapter");
    await expect(
      librarianRemoveChapter(deps, {
        book_slug: "book-with-chapter",
        chapter_slug: "nonexistent",
      }),
    ).rejects.toThrow("Chapter not found");
  });
});

// ---------------------------------------------------------------------------
// Cache invariant
// ---------------------------------------------------------------------------

describe("cache invariant", () => {
  it("clears caches after add", async () => {
    await librarianAddBook(deps, {
      slug: "cache-test",
      title: "Cache Test",
      number: "I",
      sortOrder: 1,
      domain: ["teaching"],
    });
    expect(clearCaches).toHaveBeenCalledTimes(1);
  });

  it("clears caches after remove", async () => {
    await writeManifest("remove-cache-test");
    await librarianRemoveBook(deps, { slug: "remove-cache-test" });
    expect(clearCaches).toHaveBeenCalledTimes(1);
  });
});
