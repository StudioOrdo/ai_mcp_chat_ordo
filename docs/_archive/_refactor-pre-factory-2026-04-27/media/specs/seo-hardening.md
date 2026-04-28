# Feature Spec: SEO Hardening — Lighthouse 100

**Status:** Draft Spec — Not Yet Implemented
**Priority:** Phase 2 (after corpus scaffold)
**Execution Surface:** Next.js metadata, sitemap, robots, structured data
**Dependencies:** `library-metadata.ts`, `robots.ts`, `sitemap.ts`, `PublicJournalPages.tsx`

---

## Purpose

Achieve a **Lighthouse SEO score of 100** and make every library chapter and journal article a first-class social sharing target. The system already has ~80% of the infrastructure. This spec closes the remaining gaps.

---

## Current State

| Feature | Library Chapters | Journal Articles | Gap |
|---|---|---|---|
| `<title>` tag | ✅ `{chapter} — {book} \| {site}` | ✅ `{title} \| {site}` | None |
| Meta description | ⚠️ Extracted from first 160 chars | ✅ Post `description` field | Library needs frontmatter-driven descriptions |
| Open Graph | ✅ `og:title`, `og:description`, `og:url` | ✅ Full OG with hero image | Library missing `og:image` |
| `og:image` | ❌ Falls back to logo | ✅ Hero image from pipeline | Library needs per-chapter OG images |
| Twitter card | ❌ Not set on chapter pages | ❌ Not set on article pages | Both need explicit `twitter:card` |
| JSON-LD | ✅ `Article` schema | ❌ Missing on journal articles | Journal needs structured data |
| `robots.txt` | ✅ Allows `/library/` | ❌ Missing `/journal/` | Add journal routes |
| Sitemap | ✅ Library chapters included | ✅ Journal posts included | None |
| Canonical URLs | ✅ Set correctly | ✅ Set correctly | None |
| `lang` attribute | ✅ `lang="en"` on `<html>` | ✅ Same | None |

---

## Implementation

### 1. Frontmatter-Driven Meta Descriptions

**File:** `src/lib/seo/library-metadata.ts`

Replace content extraction with frontmatter `seo.description`:

```typescript
export function buildChapterSeo(input: ChapterMetadataInput): ChapterSeo {
  const description = input.seoDescription
    ?? extractDescription(input.content);
  // ... rest unchanged
}
```

**File:** `src/app/library/[document]/[section]/page.tsx`

Pass frontmatter description through:

```typescript
return buildChapterMetadata({
  // ... existing fields ...
  seoDescription: result.seoDescription,  // from frontmatter
});
```

### 2. Per-Chapter OG Images

**Option A (quick):** Generate a text-on-gradient OG image using `@vercel/og` or a similar library. Title + book name on a branded background. No external image generation needed.

**Option B (premium):** Use the existing `blog-image.tool.ts` hero image pipeline to generate unique chapter illustrations. Store as static assets alongside chapters.

**Recommendation:** Start with Option A for all chapters. Upgrade high-traffic chapters to Option B over time.

```typescript
// In library-metadata.ts
openGraph: {
  title: input.chapterTitle,
  description,
  url: canonicalUrl,
  siteName: identity.name,
  type: "article",
  images: [{
    url: input.ogImageUrl ?? `https://${identity.domain}/api/og/chapter?title=${encodeURIComponent(input.chapterTitle)}&book=${encodeURIComponent(input.bookTitle)}`,
    alt: input.chapterTitle,
    width: 1200,
    height: 630,
  }],
},
```

### 3. Twitter Card Metadata

**File:** `src/lib/seo/library-metadata.ts`

Add Twitter card to chapter metadata:

```typescript
twitter: {
  card: "summary_large_image",
  title: input.chapterTitle,
  description,
  images: [ogImageUrl],
},
```

**File:** `src/components/journal/PublicJournalPages.tsx`

Add Twitter card to journal article metadata:

```typescript
twitter: {
  card: "summary_large_image",
  title: post.title,
  description: post.description,
  images: heroAsset ? [`https://${identity.domain}${getBlogAssetUrl(heroAsset.id)}`] : undefined,
},
```

### 4. Robots.txt Expansion

**File:** `src/app/robots.ts`

Add journal routes:

```typescript
allow: ["/", "/library", "/library/", "/journal", "/journal/"],
```

### 5. Journal Structured Data

**File:** `src/components/journal/PublicJournalPages.tsx`

Add JSON-LD `Article` schema to journal post pages:

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: post.title,
  description: post.description,
  url: getJournalPostUrl(identity.domain, post.slug),
  datePublished: post.publishedAt,
  author: {
    "@type": "Person",
    name: "Keith Williams",
  },
  publisher: {
    "@type": "Organization",
    name: identity.name,
  },
  image: heroAsset
    ? `https://${identity.domain}${getBlogAssetUrl(heroAsset.id)}`
    : undefined,
};
```

### 6. Author Attribution

**File:** `src/lib/seo/library-metadata.ts`

Upgrade JSON-LD `author` from Organization to Person:

```typescript
author: {
  "@type": "Person",
  name: "Keith Williams",
  url: identity.linkedInUrl ?? undefined,
},
```

### 7. OG Image API Route (if using Option A)

**File:** `src/app/api/og/chapter/route.tsx` (NEW)

```typescript
import { ImageResponse } from "@vercel/og";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Studio Ordo";
  const book = searchParams.get("book") ?? "";

  return new ImageResponse(
    // JSX for 1200x630 branded card with title and book name
    // Use Fraunces for display, IBM Plex Sans for body
  );
}
```

---

## Lighthouse Audit Checklist

| Audit | Current | Target | Fix |
|---|---|---|---|
| Document has a `<title>` | ✅ Pass | ✅ | — |
| Document has a meta description | ⚠️ Some empty | ✅ | Frontmatter `seo.description` |
| Document has a valid `hreflang` | ✅ Pass | ✅ | — |
| Document has a valid `robots.txt` | ⚠️ Missing journal | ✅ | Add `/journal/` |
| Page has successful HTTP status | ✅ Pass | ✅ | — |
| Document has valid structured data | ⚠️ Missing on journal | ✅ | Add JSON-LD to journal |
| Links have descriptive text | ✅ Pass | ✅ | — |
| Image elements have `alt` attributes | ✅ Pass | ✅ | — |
| Document uses legible font sizes | ✅ Pass | ✅ | — |
| Tap targets are appropriately sized | ✅ Pass | ✅ | — |

---

## Test Cases

1. **Lighthouse:** Library chapter page scores 100 in SEO category
2. **Lighthouse:** Journal article page scores 100 in SEO category
3. **Social:** Library chapter URL shared on LinkedIn shows branded OG card with title + book
4. **Social:** Journal article URL shared on LinkedIn shows hero image + standfirst
5. **Structured data:** Google Rich Results Test validates chapter JSON-LD
6. **Structured data:** Google Rich Results Test validates journal JSON-LD
7. **Crawlability:** Screaming Frog or similar crawler finds all chapters and articles via sitemap

---

*Spec drafted by Claude. For implementation by a separate engineering agent.*
