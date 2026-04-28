import { describe, it, expect } from "vitest";
import { FileSystemCorpusRepository } from "./FileSystemCorpusRepository";
import { ResourceNotFoundError } from "../core/entities/errors";


describe("FileSystemCorpusRepository", () => {
  it("should instantiate successfully", () => {
    const repo = new FileSystemCorpusRepository();
    expect(repo).toBeDefined();
  });

  it("should return all documents", async () => {
    const repo = new FileSystemCorpusRepository();
    const documents = await repo.getAllDocuments();
    expect(documents.length).toBeGreaterThan(0);
  });

  it("should throw ResourceNotFoundError when getting sections for non-existent document", async () => {
    const repo = new FileSystemCorpusRepository();
    await expect(repo.getSectionsByDocument("non-existent-book")).rejects.toThrow(ResourceNotFoundError);
  });

  it("should throw ResourceNotFoundError when getting non-existent section", async () => {
    const repo = new FileSystemCorpusRepository();
    await expect(repo.getSection("book-1", "non-existent-chapter")).rejects.toThrow(ResourceNotFoundError);
  });
});
