import type {
  BriefObjectRef,
  BriefVisibilityPolicy,
  SectionBrief,
  StoredSectionBrief,
} from "@/core/entities/brief";

export interface SectionBriefStore {
  findCurrentSectionBrief(
    sectionId: string,
    input?: {
      ownerUserId?: string | null;
      visibilityPolicy?: BriefVisibilityPolicy;
    },
  ): Promise<StoredSectionBrief | null>;
  findCurrentForScope?(input: {
    sectionId: string;
    ownerUserId?: string | null;
    visibilityPolicy: BriefVisibilityPolicy;
    objectRef?: BriefObjectRef | null;
  }): Promise<StoredSectionBrief | null>;
}

export interface ResolveSectionBriefInput {
  briefs?: SectionBriefStore | null;
  sectionId: string;
  ownerUserId?: string | null;
  visibilityPolicy?: BriefVisibilityPolicy;
  objectRef?: BriefObjectRef | null;
  fallback: SectionBrief;
  mapperUnavailableLimitation?: string;
}

export interface SectionBriefResolution {
  brief: SectionBrief;
  source: "stored" | "deterministic_fallback";
  mapperUnavailable: boolean;
}

export const CANONICAL_SECTION_BRIEF_INVENTORY = [
  {
    sectionId: "conversations",
    surface: "Conversations",
    currentPath: "chat surface state",
    fallbackKind: "deterministic conversation selector",
  },
  {
    sectionId: "today",
    surface: "Today",
    currentPath: "today-brief-read-model",
    fallbackKind: "deterministic evidence index",
  },
  {
    sectionId: "studio",
    surface: "Studio",
    currentPath: "studio workspace projector",
    fallbackKind: "deterministic production brief",
  },
  {
    sectionId: "people",
    surface: "People",
    currentPath: "business people read model",
    fallbackKind: "deterministic relationship brief",
  },
  {
    sectionId: "offers",
    surface: "Offers",
    currentPath: "offer workspace read model",
    fallbackKind: "deterministic offer brief",
  },
  {
    sectionId: "about",
    surface: "About",
    currentPath: "about workspace read model",
    fallbackKind: "deterministic public story brief",
  },
  {
    sectionId: "knowledge-base",
    surface: "Knowledge Base",
    currentPath: "knowledge source inventory",
    fallbackKind: "deterministic source brief",
  },
  {
    sectionId: "account",
    surface: "Account",
    currentPath: "profile settings panel",
    fallbackKind: "deterministic account settings brief",
  },
  {
    sectionId: "admin-system",
    surface: "System",
    currentPath: "admin system workspace loader",
    fallbackKind: "deterministic admin system brief",
  },
] as const;

export async function resolveSectionBrief(
  input: ResolveSectionBriefInput,
): Promise<SectionBriefResolution> {
  if (!input.briefs) {
    return {
      brief: input.fallback,
      source: "deterministic_fallback",
      mapperUnavailable: false,
    };
  }

  try {
    const stored = input.objectRef && input.briefs.findCurrentForScope
      ? await input.briefs.findCurrentForScope({
          sectionId: input.sectionId,
          ownerUserId: input.ownerUserId ?? null,
          visibilityPolicy: input.visibilityPolicy ?? "owner",
          objectRef: input.objectRef,
        })
      : await input.briefs.findCurrentSectionBrief(input.sectionId, {
          ownerUserId: input.ownerUserId ?? null,
          visibilityPolicy: input.visibilityPolicy ?? "owner",
        });

    if (stored) {
      return {
        brief: stored,
        source: "stored",
        mapperUnavailable: false,
      };
    }
  } catch {
    return {
      brief: withMapperUnavailableLimitation(input.fallback, input.mapperUnavailableLimitation),
      source: "deterministic_fallback",
      mapperUnavailable: true,
    };
  }

  return {
    brief: input.fallback,
    source: "deterministic_fallback",
    mapperUnavailable: false,
  };
}

function withMapperUnavailableLimitation(
  fallback: SectionBrief,
  limitation = "Stored brief read model is unavailable, so this section is showing deterministic evidence only.",
): SectionBrief {
  return {
    ...fallback,
    status: fallback.status === "fresh" ? "limited" : fallback.status,
    limitations: fallback.limitations.includes(limitation)
      ? fallback.limitations
      : [...fallback.limitations, limitation],
  };
}
