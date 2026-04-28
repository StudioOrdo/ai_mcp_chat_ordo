import { hasDuplicateStrings, isNonEmptyTrimmedString, isPositiveInteger, isValidTimestamp, pushError } from "./factory-validation";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

export interface PublishedDestination {
  channel: string;
  url: string;
}

export interface SocialPost {
  platform: "twitter" | "linkedin" | "facebook";
  content: string;
  scheduledAt?: string;
  postedAt?: string;
  postUrl?: string;
}

export interface ReleaseMetrics {
  viewCount?: number;
  engagementByChannel?: Record<string, number>;
}

export interface Release {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  version: string;
  releaseNumber: number;
  compositionId: string;
  publishedDestinations: readonly PublishedDestination[];
  releasedAt: string;
  releasedBy: string;
  approvedBy?: string;
  releaseNotes?: string;
  archiveUri?: string;
  socialPosts?: readonly SocialPost[];
  metrics?: ReleaseMetrics;
}

export function listReleaseValidationErrors(release: Release): string[] {
  const errors: string[] = [];
  const channels = release.publishedDestinations.map((destination) => destination.channel);

  pushError(errors, release.schemaVersion !== 1, "Release.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(release.id), "Release.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(release.workOrderId), "Release.workOrderId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(release.compositionId), "Release.compositionId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(release.releasedBy), "Release.releasedBy must be a non-empty string.");
  pushError(errors, !isValidTimestamp(release.releasedAt), "Release.releasedAt must be a valid timestamp.");
  pushError(errors, !isPositiveInteger(release.releaseNumber), "Release.releaseNumber must be a positive integer.");
  pushError(errors, !SEMVER_PATTERN.test(release.version), "Release.version must match semantic versioning.");
  pushError(errors, hasDuplicateStrings(channels), "Release.publishedDestinations cannot contain duplicate channels.");

  for (const destination of release.publishedDestinations) {
    pushError(errors, !isNonEmptyTrimmedString(destination.channel), "PublishedDestination.channel must be a non-empty string.");
    pushError(errors, !isNonEmptyTrimmedString(destination.url), `PublishedDestination ${destination.channel} url must be non-empty.`);
  }

  for (const post of release.socialPosts ?? []) {
    pushError(errors, !isNonEmptyTrimmedString(post.content), `SocialPost ${post.platform} content must be non-empty.`);
    if (post.scheduledAt !== undefined) {
      pushError(errors, !isValidTimestamp(post.scheduledAt), `SocialPost ${post.platform} scheduledAt must be a valid timestamp.`);
    }
    if (post.postedAt !== undefined) {
      pushError(errors, !isValidTimestamp(post.postedAt), `SocialPost ${post.platform} postedAt must be a valid timestamp.`);
    }
    pushError(
      errors,
      post.postUrl !== undefined && post.postedAt === undefined,
      `SocialPost ${post.platform} postUrl cannot be present without postedAt.`,
    );
  }

  return errors;
}