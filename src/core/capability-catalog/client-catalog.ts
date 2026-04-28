import type { CapabilityDefinition } from "./capability-definition";
import { AFFILIATE_CAPABILITIES } from "./families/affiliate-capabilities";
import {
  ADMIN_OPERATIONS_CAPABILITIES,
  ADMIN_PILOT_CAPABILITIES,
} from "./families/admin-capabilities";
import {
  BLOG_JOURNAL_CAPABILITIES,
  BLOG_PILOT_CAPABILITIES,
  BLOG_PRODUCTION_CAPABILITIES,
} from "./families/blog-capabilities";
import { SHARED_CALCULATOR_CAPABILITIES } from "./families/calculator-capabilities.shared";
import { CONVERSATION_CAPABILITIES } from "./families/conversation-capabilities";
import { CORPUS_CAPABILITIES } from "./families/corpus-capabilities";
import { JOB_CAPABILITIES } from "./families/job-capabilities";
import { MEDIA_CAPABILITIES } from "./families/media-capabilities";
import { NAVIGATION_CAPABILITIES } from "./families/navigation-capabilities";
import { PROFILE_CAPABILITIES } from "./families/profile-capabilities";
import { THEME_CAPABILITIES } from "./families/theme-capabilities";

export const CLIENT_CAPABILITY_CATALOG = {
  ...BLOG_PILOT_CAPABILITIES,
  ...MEDIA_CAPABILITIES,
  ...ADMIN_PILOT_CAPABILITIES,
  ...SHARED_CALCULATOR_CAPABILITIES,
  ...THEME_CAPABILITIES,
  ...NAVIGATION_CAPABILITIES,
  ...CORPUS_CAPABILITIES,
  ...CONVERSATION_CAPABILITIES,
  ...PROFILE_CAPABILITIES,
  ...JOB_CAPABILITIES,
  ...ADMIN_OPERATIONS_CAPABILITIES,
  ...AFFILIATE_CAPABILITIES,
  ...BLOG_JOURNAL_CAPABILITIES,
  ...BLOG_PRODUCTION_CAPABILITIES,
} as const satisfies Record<string, CapabilityDefinition>;

export type ClientCapabilityName = keyof typeof CLIENT_CAPABILITY_CATALOG;