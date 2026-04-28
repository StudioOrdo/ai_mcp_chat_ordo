import fs from "fs/promises";
import type { Dirent } from "fs";
import path from "path";
import { isContentAudience, type ContentAudience } from "@/lib/access/content-access";
import type { CorpusRepository } from "../core/use-cases/CorpusRepository";
import type { Document } from "../core/entities/corpus";
import { Section } from "../core/entities/corpus";
import { ResourceNotFoundError } from "../core/entities/errors";
import { ExtractPractitioners } from "../core/use-cases/ExtractPractitioners";
import { AnalyzeChapterChecklist } from "../core/use-cases/AnalyzeChapterChecklist";
import { logDegradation } from "@/lib/observability/logger";

export const DEFAULT_DOCS_DIR = "docs";
const CORPUS_DIR = "_corpus";
const VALID_DOMAINS = new Set([
	"teaching",
	"sales",
	"customer-service",
	"reference",
	"internal",
]);

interface DocumentMeta {
	slug: string;
	title: string;
	shortTitle: string;
	number: string;
	sectionsDir: string;
	audience: ContentAudience;
	class?: string;
	rolePersona?: string;
}

interface DocumentManifest {
	slug: string;
	title: string;
	number: string;
	sortOrder: number;
	domain: string[];
	tags?: string[];
	audience?: ContentAudience;
	class?: string;
	rolePersona?: string;
}

export class FileSystemCorpusRepository implements CorpusRepository {
	private readonly contributorExtractor = new ExtractPractitioners();
	private readonly supplementAnalyzer = new AnalyzeChapterChecklist();
	private discoveredDocuments: DocumentMeta[] | null = null;

	constructor(
		private readonly docsDir: string = path.join(
			process.cwd(),
			DEFAULT_DOCS_DIR,
		),
	) {}

	private async discoverDocuments(): Promise<DocumentMeta[]> {
		if (this.discoveredDocuments) return this.discoveredDocuments;

		const corpusDir = path.join(this.docsDir, CORPUS_DIR);
		let entries: Dirent[];
		try {
			entries = await fs.readdir(corpusDir, { withFileTypes: true });
		} catch {
			return [];
		}

		const documentsWithOrder: Array<{ meta: DocumentMeta; sortOrder: number }> = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			try {
				const raw = await fs.readFile(
					path.join(corpusDir, entry.name, "book.json"),
					"utf-8",
				);
				const manifest: DocumentManifest = JSON.parse(raw);
				if (typeof manifest.slug !== "string" || !manifest.slug) continue;
				if (typeof manifest.title !== "string" || !manifest.title) continue;
				if (typeof manifest.number !== "string" || !manifest.number) continue;
				if (typeof manifest.sortOrder !== "number") continue;
				if (!Array.isArray(manifest.domain) || manifest.domain.length === 0) continue;
				if (manifest.domain.some((domain: string) => !VALID_DOMAINS.has(domain))) continue;
				if (manifest.audience !== undefined && !isContentAudience(manifest.audience)) continue;
				if (entry.name !== manifest.slug) {
					logDegradation("CORPUS_SLUG_MISMATCH", `Slug mismatch: dir "${entry.name}" vs slug "${manifest.slug}" — skipping`, { dir: entry.name, slug: manifest.slug });
					continue;
				}
				documentsWithOrder.push({
					meta: {
						slug: manifest.slug,
						title: manifest.title,
						shortTitle: manifest.title,
						number: manifest.number,
						sectionsDir: path.join(CORPUS_DIR, manifest.slug, "chapters"),
						audience: manifest.audience ?? "public",
						class: typeof manifest.class === "string" ? manifest.class : undefined,
						rolePersona: typeof manifest.rolePersona === "string" ? manifest.rolePersona : undefined,
					},
					sortOrder: manifest.sortOrder,
				});
			} catch {
				// No book.json or invalid JSON — skip this directory.
			}
		}

		this.discoveredDocuments = documentsWithOrder
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(({ meta }) => meta);
		return this.discoveredDocuments;
	}

	clearDiscoveryCache(): void {
		this.discoveredDocuments = null;
	}

	async getAllDocuments(): Promise<Document[]> {
		const documents = await this.discoverDocuments();
		return documents.map((document) => ({
			slug: document.slug,
			title: document.title,
			number: document.number,
			id: document.number,
			audience: document.audience,
			class: document.class,
			rolePersona: document.rolePersona,
		}));
	}

	async getDocument(slug: string): Promise<Document | null> {
		const documents = await this.discoverDocuments();
		const document = documents.find((candidate) => candidate.slug === slug);
		if (!document) return null;
		return {
			slug: document.slug,
			title: document.title,
			number: document.number,
			id: document.number,
			audience: document.audience,
			class: document.class,
			rolePersona: document.rolePersona,
		};
	}

	async getSectionsByDocument(documentSlug: string): Promise<Section[]> {
		const documents = await this.discoverDocuments();
		const documentMeta = documents.find((candidate) => candidate.slug === documentSlug);
		if (!documentMeta) {
			throw new ResourceNotFoundError(`Document not found: ${documentSlug}`);
		}

		const sectionsDir = path.join(this.docsDir, documentMeta.sectionsDir);

		try {
			const files = await fs.readdir(sectionsDir);
			const markdownFiles = files.filter((filename) => filename.endsWith(".md")).sort();

			const sections: Section[] = [];
			for (const filename of markdownFiles) {
				const slug = filename.replace(/\.md$/, "");
				const content = await fs.readFile(
					path.join(sectionsDir, filename),
					"utf-8",
				);
				sections.push(this.parseSection(documentMeta, slug, content));
			}
			return sections;
		} catch (error) {
			if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
				return [];
			}
			throw new ResourceNotFoundError(`Failed to read sections for document: ${documentSlug}`);
		}
	}

	async getAllSections(): Promise<Section[]> {
		const documents = await this.getAllDocuments();
		const allSections: Section[] = [];
		for (const document of documents) {
			const sections = await this.getSectionsByDocument(document.slug);
			allSections.push(...sections);
		}
		return allSections;
	}

	async getSection(documentSlug: string, sectionSlug: string): Promise<Section> {
		const documents = await this.discoverDocuments();
		const documentMeta = documents.find((candidate) => candidate.slug === documentSlug);
		if (!documentMeta) {
			throw new ResourceNotFoundError(`Document not found: ${documentSlug}`);
		}

		const filepath = path.join(
			this.docsDir,
			documentMeta.sectionsDir,
			`${sectionSlug}.md`,
		);
		try {
			const content = await fs.readFile(filepath, "utf-8");
			return this.parseSection(documentMeta, sectionSlug, content);
		} catch {
			throw new ResourceNotFoundError(`Section not found: ${sectionSlug}`);
		}
	}

	private parseFrontmatter(content: string): {
		body: string;
		data: Record<string, string>;
	} {
		const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
		if (!match) {
			return { body: content, data: {} };
		}

		const data: Record<string, string> = {};
		for (const line of match[1].split(/\r?\n/)) {
			const separatorIndex = line.indexOf(":");
			if (separatorIndex === -1) continue;
			const key = line.slice(0, separatorIndex).trim();
			const value = line.slice(separatorIndex + 1).trim();
			if (!key || !value) continue;
			data[key] = value.replace(/^['"]|['"]$/g, "");
		}

		return {
			body: content.slice(match[0].length).trimStart(),
			data,
		};
	}

	private parseSection(
		documentMeta: DocumentMeta,
		sectionSlug: string,
		content: string,
	): Section {
		const { body, data } = this.parseFrontmatter(content);
		const audience = data.audience ?? documentMeta.audience;
		if (!isContentAudience(audience)) {
			throw new Error(`Invalid audience for ${documentMeta.slug}/${sectionSlug}: ${audience}`);
		}

		const titleMatch = body.match(/^#\s+(.*)/m);
		const title = titleMatch ? titleMatch[1].trim() : sectionSlug;

		const contributors = this.contributorExtractor.execute(body);
		const supplements = this.supplementAnalyzer.execute(body);

		const headings = [...body.matchAll(/^##\s+(.*)/gm)].map((match) =>
			match[1].trim(),
		);

		return new Section(
			documentMeta.slug,
			sectionSlug,
			title,
			body,
			contributors,
			supplements,
			headings,
			audience,
			data.class ?? documentMeta.class,
			data.rolePersona ?? documentMeta.rolePersona,
		);
	}
}