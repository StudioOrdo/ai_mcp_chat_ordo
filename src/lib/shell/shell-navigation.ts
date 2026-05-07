import type { RoleName, User as SessionUser } from "@/core/entities/user";
import type {
  ObjectCenteredSurface,
  OrdoObjectKind,
} from "@/core/entities/ordo-object";
import { DEFAULT_IDENTITY } from "@/lib/config/defaults";

export {
  OBJECT_CENTERED_PRIMARY_SURFACES,
  OBJECT_CENTERED_SURFACES,
  ORDO_DETAIL_LENSES,
  ORDO_OBJECT_KIND_CONTRACTS,
  ORDO_OBJECT_KINDS,
} from "@/core/entities/ordo-object";

export type {
  ObjectCenteredSurface,
  OrdoDetailLens,
  OrdoObjectKind,
  OrdoObjectKindContract,
} from "@/core/entities/ordo-object";

export type ShellRouteKind = "internal" | "external";

type ShellVisibility = "all" | readonly RoleName[];
type ShellContentGate = "public-feed";

export const SHELL_ROUTE_DISPOSITIONS = [
  "primary",
  "secondary",
  "diagnostic",
  "donor",
  "legacy",
] as const;

export type ShellRouteDisposition = typeof SHELL_ROUTE_DISPOSITIONS[number];

export interface ShellNavigationContext {
  hasPublicFeedItems: boolean;
}

export const DEFAULT_SHELL_NAVIGATION_CONTEXT: ShellNavigationContext = {
  hasPublicFeedItems: false,
};

export interface ShellRouteDefinition {
  id: string;
  label: string;
  href: string;
  kind: ShellRouteKind;
  targetSurface: ObjectCenteredSurface;
  routeDisposition: ShellRouteDisposition;
  description?: string;
  isLegacy?: boolean;
  contentGate?: ShellContentGate;
  objectKinds?: readonly OrdoObjectKind[];
  diagnosticFor?: readonly OrdoObjectKind[];
  showInCommands?: boolean;
  headerVisibility?: ShellVisibility;
  footerVisibility?: ShellVisibility;
  accountVisibility?: ShellVisibility;
}

export interface ShellFooterGroup {
  id: string;
  label: string;
  routeIds: string[];
  visibility: ShellVisibility;
}

export interface ShellNavDrawerGroup {
  id: string;
  label: string;
  description?: string;
  routeIds: string[];
  visibility: ShellVisibility;
}

export interface ResolvedShellNavDrawerGroup {
  id: string;
  label: string;
  description?: string;
  routes: ShellRouteDefinition[];
}

export interface ShellRouteVisibilitySnapshot {
  command: boolean;
  header: boolean;
  footer: boolean;
  account: boolean;
  any: boolean;
}

export interface ShellBrandMetadata {
  name: string;
  shortName: string;
  homeHref: string;
  ariaLabel: string;
  markText: string;
}

export const SHELL_BRAND: ShellBrandMetadata = {
  name: DEFAULT_IDENTITY.name,
  shortName: DEFAULT_IDENTITY.shortName,
  homeHref: "/",
  ariaLabel: `${DEFAULT_IDENTITY.name} home`,
  markText: DEFAULT_IDENTITY.markText,
};

const SIGNED_IN_ROLES = ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"] as const;

export const SHELL_ROUTES: readonly ShellRouteDefinition[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "primary",
    description: "Return to the main homepage and chat entry point.",
    footerVisibility: "all",
    showInCommands: true,
  },
  {
    id: "ordo-chat",
    label: "Conversations",
    href: "/",
    kind: "internal",
    targetSurface: "business",
    routeDisposition: "primary",
    objectKinds: ["conversation", "person"],
    description: "Open conversations with Ordo now and future person transfer slots later.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
    showInCommands: true,
  },
  {
    id: "feed",
    label: "Feed",
    href: "/feed",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "primary",
    objectKinds: ["content_item"],
    description: "View public updates and published media when the owner chooses to share them.",
    contentGate: "public-feed",
    footerVisibility: "all",
    showInCommands: true,
  },
  {
    id: "offers",
    label: "Offers",
    href: "/offers",
    kind: "internal",
    targetSurface: "offers",
    routeDisposition: "primary",
    objectKinds: ["offer"],
    description: "Review public offers or govern owner offers after signing in.",
    accountVisibility: SIGNED_IN_ROLES,
    footerVisibility: "all",
    showInCommands: true,
  },
  {
    id: "about",
    label: "About",
    href: "/about",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "primary",
    description: "Learn what this Ordo instance is and how it helps the business operate.",
    footerVisibility: "all",
    showInCommands: true,
  },
  {
    id: "business-about",
    label: "About",
    href: "/about",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "primary",
    description: "Review the business and public About surface from the owner workspace.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
  },
  {
    id: "journal-public",
    label: "Journal",
    href: "/journal",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "donor",
    objectKinds: ["content_item"],
    description: "Read published journal posts from this Ordo instance.",
  },
  {
    id: "library",
    label: "Library",
    href: "/library",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "donor",
    objectKinds: ["content_item"],
    description: "Read corpus-backed reference material when directly linked.",
  },
  {
    id: "knowledge-base",
    label: "Knowledge Base",
    href: "/knowledge",
    kind: "internal",
    targetSurface: "knowledge_base",
    routeDisposition: "primary",
    objectKinds: ["content_item"],
    description: "Inspect role-governed business knowledge and source evidence.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
    showInCommands: true,
  },
  {
    id: "admin-dashboard",
    label: "Admin",
    href: "/admin",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "primary",
    description: "Open the admin dashboard overview.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },

  {
    id: "workspace-overview",
    label: "Today",
    href: "/workspace",
    kind: "internal",
    targetSurface: "dashboard",
    routeDisposition: "primary",
    description: "Open Today for attention, current work, outputs, and the next useful action.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
    showInCommands: true,
  },
  {
    id: "studio",
    label: "Studio",
    href: "/studio",
    kind: "internal",
    targetSurface: "studio",
    routeDisposition: "primary",
    objectKinds: ["media_asset", "content_item", "workflow_run", "operation"],
    description: "Open the production workspace for generated media, workflows, and current work.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
    showInCommands: true,
  },
  {
    id: "business",
    label: "People",
    href: "/business",
    kind: "internal",
    targetSurface: "business",
    routeDisposition: "primary",
    objectKinds: ["person", "tracked_link", "campaign", "conversation"],
    description: "Open People for relationships, referrals, and customer-facing signals.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
    showInCommands: true,
  },
  {
    id: "jobs",
    label: "Jobs",
    href: "/jobs",
    kind: "internal",
    targetSurface: "studio",
    routeDisposition: "donor",
    objectKinds: ["workflow_run"],
    diagnosticFor: ["media_asset", "content_item", "workflow_run", "operation"],
    description: "Direct diagnostic route for current and recent deferred jobs.",
  },
  {
    id: "activity",
    label: "Activity",
    href: "/activity",
    kind: "internal",
    targetSurface: "diagnostic",
    routeDisposition: "diagnostic",
    diagnosticFor: [
      "media_asset",
      "content_item",
      "workflow_run",
      "operation",
      "person",
      "offer",
      "tracked_link",
      "campaign",
      "conversation",
    ],
    description: "Direct diagnostic route for durable activity, attention receipts, and the full work ledger.",
  },
  {
    id: "my-media",
    label: "Media",
    href: "/my/media",
    kind: "internal",
    targetSurface: "studio",
    routeDisposition: "donor",
    objectKinds: ["media_asset", "content_item"],
    description: "Direct donor route for governed personal media and unattached file cleanup.",
  },
  {
    id: "my-content",
    label: "Content",
    href: "/studio?kind=content_item",
    kind: "internal",
    targetSurface: "studio",
    routeDisposition: "secondary",
    objectKinds: ["content_item"],
    description: "Open the user's content objects in the Studio governance surface.",
  },
  {
    id: "referrals",
    label: "Affiliate Dashboard",
    href: "/referrals",
    kind: "internal",
    targetSurface: "business",
    routeDisposition: "donor",
    objectKinds: ["person", "tracked_link", "campaign"],
    description: "Direct donor route for referral sharing, activity, and trust-distribution next actions.",
    accountVisibility: SIGNED_IN_ROLES,
  },
  {
    id: "operations-media",
    label: "Media Ops",
    href: "/operations/media",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "diagnostic",
    diagnosticFor: ["media_asset", "workflow_run", "operation"],
    description: "Inspect governed media across the fleet without widening the admin shell.",
    footerVisibility: ["STAFF", "ADMIN"],
    accountVisibility: ["STAFF", "ADMIN"],
    showInCommands: true,
  },
  {
    id: "journal-admin",
    label: "Journal",
    href: "/admin/journal",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "donor",
    objectKinds: ["content_item", "media_asset"],
    description: "Manage journal inventory, workflow, and preview states.",
    accountVisibility: ["STAFF", "ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "admin-users",
    label: "Users",
    href: "/admin/users",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "primary",
    objectKinds: ["person"],
    description: "Review people, roles, and account context.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "admin-system",
    label: "System",
    href: "/admin/system",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "primary",
    diagnosticFor: ["operation"],
    description: "Inspect feature flags, model policy, and runtime status.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "admin-leads",
    label: "Leads",
    href: "/admin/leads",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "primary",
    objectKinds: ["person", "conversation"],
    description: "Review operator lead queue and next actions.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "admin-training",
    label: "Training",
    href: "/admin/training",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "secondary",
    description: "Access internal training references and operator playbooks.",
    accountVisibility: ["STAFF", "ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "admin-affiliates",
    label: "Affiliates",
    href: "/admin/affiliates",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "primary",
    objectKinds: ["person", "tracked_link", "campaign"],
    description: "Review affiliate performance, exception backlog, and credit-ready referrals.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "admin-prompts",
    label: "Prompts",
    href: "/admin/prompts",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "secondary",
    description: "Configure system prompts and prompt templates.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "admin-conversations",
    label: "Conversations",
    href: "/admin/conversations",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "primary",
    objectKinds: ["conversation", "person"],
    description: "Browse and inspect conversation transcripts.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "admin-jobs",
    label: "Jobs",
    href: "/admin/jobs",
    kind: "internal",
    targetSurface: "admin",
    routeDisposition: "diagnostic",
    diagnosticFor: ["workflow_run", "operation"],
    description: "Monitor deferred jobs, queue health, and execution logs.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "profile",
    label: "My Account",
    href: "/profile",
    kind: "internal",
    targetSurface: "profile_settings",
    routeDisposition: "primary",
    description: "Manage user info, password, preferences, and account access.",
    accountVisibility: SIGNED_IN_ROLES,
  },
  {
    id: "change-password",
    label: "Change Password",
    href: "/profile?section=password",
    kind: "internal",
    targetSurface: "profile_settings",
    routeDisposition: "secondary",
    description: "Update the password for this signed-in account.",
  },
  {
    id: "my-conversations",
    label: "Conversations",
    href: "/business?kind=conversation",
    kind: "internal",
    targetSurface: "business",
    routeDisposition: "secondary",
    objectKinds: ["conversation", "person"],
    description: "Open relationship conversations in the People governance surface.",
  },
  {
    id: "my-offers",
    label: "Offers",
    href: "/offers?scope=mine",
    kind: "internal",
    targetSurface: "offers",
    routeDisposition: "secondary",
    objectKinds: ["offer"],
    description: "Open the user's offer objects in the Offers governance surface.",
  },
  {
    id: "preferences",
    label: "Preferences",
    href: "/profile?section=preferences",
    kind: "internal",
    targetSurface: "profile_settings",
    routeDisposition: "secondary",
    description: "Open personal preferences and accessibility settings.",
  },
  {
    id: "login",
    label: "Login",
    href: "/login",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "secondary",
    footerVisibility: ["ANONYMOUS"],
  },
  {
    id: "register",
    label: "Register",
    href: "/register",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "secondary",
    footerVisibility: ["ANONYMOUS"],
  },
  {
    id: "legacy-books-index",
    label: "Legacy Books Index",
    href: "/books",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "legacy",
    isLegacy: true,
  },
  {
    id: "legacy-book-chapter",
    label: "Legacy Book Chapter Redirect",
    href: "/book/[chapter]",
    kind: "internal",
    targetSurface: "public",
    routeDisposition: "legacy",
    isLegacy: true,
  },
] as const;

export const CURRENT_OBJECT_CENTERED_SURFACE_GAPS: readonly {
  surface: ObjectCenteredSurface;
  plannedRoute: string;
  donorRouteIds: readonly string[];
  notes: string;
}[] = [] as const;

function getActiveRoles(user?: Pick<SessionUser, "roles"> | null): readonly RoleName[] {
  return user?.roles?.length ? user.roles : ["ANONYMOUS"];
}

function matchesVisibility(
  visibility: ShellVisibility | undefined,
  user?: Pick<SessionUser, "roles"> | null,
): boolean {
  if (!visibility) {
    return false;
  }

  if (visibility === "all") {
    return true;
  }

  const roles = getActiveRoles(user);
  return roles.some((role) => visibility.includes(role));
}

function matchesContentGate(
  route: ShellRouteDefinition,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): boolean {
  if (!route.contentGate) {
    return true;
  }

  if (route.contentGate === "public-feed") {
    return context.hasPublicFeedItems;
  }

  return false;
}

function resolveRouteSet(
  routeIds: readonly string[],
  user: Pick<SessionUser, "roles"> | null | undefined,
  visibilityResolver: (route: ShellRouteDefinition) => ShellVisibility | undefined,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): ShellRouteDefinition[] {
  return routeIds
    .map(getShellRouteById)
    .filter((route) =>
      matchesVisibility(visibilityResolver(route), user) &&
      matchesContentGate(route, context),
    );
}

export function getShellRouteVisibilitySnapshot(
  route: ShellRouteDefinition,
  user?: Pick<SessionUser, "roles"> | null,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): ShellRouteVisibilitySnapshot {
  const command = route.showInCommands
    ? matchesVisibility(
        route.footerVisibility ?? route.headerVisibility ?? route.accountVisibility,
        user,
      ) && matchesContentGate(route, context)
    : false;
  const header = matchesVisibility(route.headerVisibility, user) && matchesContentGate(route, context);
  const footer = matchesVisibility(route.footerVisibility, user) && matchesContentGate(route, context);
  const account = matchesVisibility(route.accountVisibility, user) && matchesContentGate(route, context);

  return {
    command,
    header,
    footer,
    account,
    any: command || header || footer || account,
  };
}

export function canRoleAccessShellRoute(
  route: ShellRouteDefinition,
  role: RoleName,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): boolean {
  return getShellRouteVisibilitySnapshot(route, { roles: [role] }, context).any;
}

export function resolvePrimaryNavRoutes(
  user?: Pick<SessionUser, "roles"> | null,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): ShellRouteDefinition[] {
  return resolveRouteSet(
    PRIMARY_NAV_ROUTE_IDS,
    user,
    (route) => route.footerVisibility ?? route.headerVisibility ?? route.accountVisibility ?? "all",
    context,
  );
}

export function resolveCommandRoutes(
  user?: Pick<SessionUser, "roles"> | null,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): ShellRouteDefinition[] {
  return SHELL_ROUTES.filter(
    (route) =>
      route.showInCommands &&
      matchesVisibility(
        route.footerVisibility ?? route.headerVisibility ?? route.accountVisibility,
        user,
      ) &&
      matchesContentGate(route, context),
  );
}

export const SHELL_FOOTER_GROUPS: readonly ShellFooterGroup[] = [
  {
    id: "information",
    label: "Information",
    routeIds: ["home", "feed", "offers", "about"],
    visibility: "all",
  },
  {
    id: "workspace",
    label: "Workspace",
    routeIds: ["workspace-overview", "studio", "business", "knowledge-base"],
    visibility: SIGNED_IN_ROLES,
  },
  {
    id: "access",
    label: "Access",
    routeIds: ["login", "register"],
    visibility: ["ANONYMOUS"],
  },
] as const;

export const PRIMARY_NAV_ROUTE_IDS = ["home", "feed", "offers", "about"] as const;
export const ACCOUNT_MENU_ROUTE_IDS = ["profile", "referrals"] as const;
export const AUTHENTICATED_WORK_RAIL_ROUTE_IDS = [
  "ordo-chat",
  "workspace-overview",
  "studio",
  "business",
  "offers",
  "business-about",
  "knowledge-base",
] as const;
export const AUTHENTICATED_ADMIN_RAIL_ROUTE_IDS = ["admin-dashboard", "admin-jobs", "admin-system"] as const;
export const RAIL_MENU_ROUTE_IDS = ["home", "feed", "offers", "about"] as const;

export const SHELL_NAV_DRAWER_GROUPS: readonly ShellNavDrawerGroup[] = [
  {
    id: "explore",
    label: "Explore",
    description: "Open the public homepage, feed, offers, and about surfaces.",
    routeIds: ["home", "feed", "offers", "about"],
    visibility: "all",
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "Open signed-in work surfaces and personal context.",
    routeIds: ["ordo-chat", "workspace-overview", "studio", "business", "offers", "business-about", "knowledge-base"],
    visibility: SIGNED_IN_ROLES,
  },
] as const;

export const SHELL_ROUTE_BY_ID = new Map(
  SHELL_ROUTES.map((route) => [route.id, route] as const),
);

export function getShellRouteById(routeId: string): ShellRouteDefinition {
  const route = SHELL_ROUTE_BY_ID.get(routeId);
  if (!route) {
    throw new Error(`Unknown shell route id: ${routeId}`);
  }

  return route;
}

export const PRIMARY_NAV_ITEMS: readonly ShellRouteDefinition[] = resolvePrimaryNavRoutes();

export function resolveFooterGroups(
  user?: Pick<SessionUser, "roles"> | null,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): ShellFooterGroup[] {
  return SHELL_FOOTER_GROUPS.filter(
    (group) =>
      matchesVisibility(group.visibility, user) &&
      resolveFooterGroupRoutes(group, user, context).length > 0,
  );
}

export function resolveFooterGroupRoutes(
  group: ShellFooterGroup,
  user?: Pick<SessionUser, "roles"> | null,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): ShellRouteDefinition[] {
  return group.routeIds
    .map(getShellRouteById)
    .filter((route) =>
      matchesVisibility(route.footerVisibility, user) &&
      matchesContentGate(route, context),
    );
}

export function resolveAccountMenuRoutes(
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteDefinition[] {
  return resolveRouteSet(ACCOUNT_MENU_ROUTE_IDS, user, (route) => route.accountVisibility);
}

export function resolveAuthenticatedWorkRailRoutes(
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteDefinition[] {
  return resolveRouteSet(AUTHENTICATED_WORK_RAIL_ROUTE_IDS, user, (route) => route.accountVisibility);
}

export function resolveAuthenticatedAdminRailRoutes(
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteDefinition[] {
  return resolveRouteSet(AUTHENTICATED_ADMIN_RAIL_ROUTE_IDS, user, (route) => route.accountVisibility);
}

export function resolveRailMenuRoutes(
  user?: Pick<SessionUser, "roles"> | null,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): ShellRouteDefinition[] {
  return resolveRouteSet(
    RAIL_MENU_ROUTE_IDS,
    user,
    (route) => route.footerVisibility ?? route.headerVisibility ?? route.accountVisibility ?? "all",
    context,
  );
}

export function resolveShellNavDrawerGroups(
  user?: Pick<SessionUser, "roles"> | null,
  context: ShellNavigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
): ResolvedShellNavDrawerGroup[] {
  return SHELL_NAV_DRAWER_GROUPS
    .filter((group) => matchesVisibility(group.visibility, user))
    .map((group) => ({
      id: group.id,
      label: group.label,
      description: group.description,
      routes: resolveRouteSet(
        group.routeIds,
        user,
        (route) => route.footerVisibility ?? route.accountVisibility ?? route.headerVisibility ?? "all",
        context,
      ),
    }))
    .filter((group) => group.routes.length > 0);
}

export function resolveShellHomeHref(): string {
  return SHELL_BRAND.homeHref;
}

export function isShellRouteActive(
  route: ShellRouteDefinition,
  pathname: string,
): boolean {
  if (route.kind !== "internal") {
    return false;
  }

  if (route.href === "/") {
    return pathname === "/";
  }

  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}
