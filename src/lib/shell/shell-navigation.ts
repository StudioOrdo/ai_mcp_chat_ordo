import type { RoleName, User as SessionUser } from "@/core/entities/user";
import { DEFAULT_IDENTITY } from "@/lib/config/defaults";

export type ShellRouteKind = "internal" | "external";

type ShellVisibility = "all" | readonly RoleName[];

export interface ShellRouteDefinition {
  id: string;
  label: string;
  href: string;
  kind: ShellRouteKind;
  description?: string;
  isLegacy?: boolean;
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
    description: "Return to the main homepage and chat entry point.",
    footerVisibility: "all",
  },
  {
    id: "corpus",
    label: "Library",
    href: "/library",
    kind: "internal",
    description: "Browse the library and structured reference material.",
    footerVisibility: "all",
    showInCommands: true,
  },
  {
    id: "journal",
    label: "Journal",
    href: "/journal",
    kind: "internal",
    description: "Read published journal content.",
    footerVisibility: "all",
    showInCommands: true,
  },
  {
    id: "admin-dashboard",
    label: "Admin",
    href: "/admin",
    kind: "internal",
    description: "Open the admin dashboard overview.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },

  {
    id: "workspace-overview",
    label: "Current Work",
    href: "/workspace",
    kind: "internal",
    description: "Open the current-work workspace summary without replacing the chat transcript surface.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
    showInCommands: true,
  },
  {
    id: "jobs",
    label: "Jobs",
    href: "/jobs",
    kind: "internal",
    description: "Review current and recent deferred jobs.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
  },
  {
    id: "my-media",
    label: "My Media",
    href: "/my/media",
    kind: "internal",
    description: "Browse governed personal media, preview assets, and clean up unattached files.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
    showInCommands: true,
  },
  {
    id: "referrals",
    label: "Referrals",
    href: "/referrals",
    kind: "internal",
    description: "Open referral sharing, activity, and trust-distribution next actions.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
    showInCommands: true,
  },
  {
    id: "operations-media",
    label: "Media Ops",
    href: "/operations/media",
    kind: "internal",
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
    description: "Monitor deferred jobs, queue health, and execution logs.",
    accountVisibility: ["ADMIN"],
    footerVisibility: ["ADMIN"],
    showInCommands: true,
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    kind: "internal",
    description: "View profile, referral, and personal settings.",
    footerVisibility: SIGNED_IN_ROLES,
    accountVisibility: SIGNED_IN_ROLES,
  },
  {
    id: "login",
    label: "Login",
    href: "/login",
    kind: "internal",
    footerVisibility: ["ANONYMOUS"],
  },
  {
    id: "register",
    label: "Register",
    href: "/register",
    kind: "internal",
    footerVisibility: ["ANONYMOUS"],
  },
  {
    id: "legacy-books-index",
    label: "Legacy Books Index",
    href: "/books",
    kind: "internal",
    isLegacy: true,
  },
  {
    id: "legacy-book-chapter",
    label: "Legacy Book Chapter Redirect",
    href: "/book/[chapter]",
    kind: "internal",
    isLegacy: true,
  },
] as const;

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

function resolveRouteSet(
  routeIds: readonly string[],
  user: Pick<SessionUser, "roles"> | null | undefined,
  visibilityResolver: (route: ShellRouteDefinition) => ShellVisibility | undefined,
): ShellRouteDefinition[] {
  return routeIds
    .map(getShellRouteById)
    .filter((route) => matchesVisibility(visibilityResolver(route), user));
}

export function getShellRouteVisibilitySnapshot(
  route: ShellRouteDefinition,
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteVisibilitySnapshot {
  const command = route.showInCommands
    ? matchesVisibility(
        route.footerVisibility ?? route.headerVisibility ?? route.accountVisibility,
        user,
      )
    : false;
  const header = matchesVisibility(route.headerVisibility, user);
  const footer = matchesVisibility(route.footerVisibility, user);
  const account = matchesVisibility(route.accountVisibility, user);

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
): boolean {
  return getShellRouteVisibilitySnapshot(route, { roles: [role] }).any;
}

export function resolvePrimaryNavRoutes(
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteDefinition[] {
  return resolveRouteSet(
    PRIMARY_NAV_ROUTE_IDS,
    user,
    (route) => route.footerVisibility ?? route.headerVisibility ?? route.accountVisibility ?? "all",
  );
}

export function resolveCommandRoutes(
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteDefinition[] {
  return SHELL_ROUTES.filter(
    (route) =>
      route.showInCommands &&
      matchesVisibility(
        route.footerVisibility ?? route.headerVisibility ?? route.accountVisibility,
        user,
      ),
  );
}

export const SHELL_FOOTER_GROUPS: readonly ShellFooterGroup[] = [
  {
    id: "information",
    label: "Information",
    routeIds: ["corpus", "journal"],
    visibility: "all",
  },
  {
    id: "workspace",
    label: "Workspace",
    routeIds: ["workspace-overview", "referrals", "operations-media", "profile"],
    visibility: SIGNED_IN_ROLES,
  },
  {
    id: "access",
    label: "Access",
    routeIds: ["login", "register"],
    visibility: ["ANONYMOUS"],
  },
] as const;

export const PRIMARY_NAV_ROUTE_IDS = ["corpus", "journal"] as const;
export const ACCOUNT_MENU_ROUTE_IDS = ["workspace-overview", "jobs", "my-media", "referrals", "operations-media", "profile"] as const;
export const RAIL_MENU_ROUTE_IDS = ["corpus", "journal"] as const;

export const SHELL_NAV_DRAWER_GROUPS: readonly ShellNavDrawerGroup[] = [
  {
    id: "explore",
    label: "Explore",
    description: "Browse the public library and published journal surfaces.",
    routeIds: ["corpus", "journal"],
    visibility: "all",
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "Open signed-in work surfaces and personal context.",
    routeIds: ["workspace-overview", "jobs", "my-media", "referrals", "operations-media", "profile"],
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
): ShellFooterGroup[] {
  return SHELL_FOOTER_GROUPS.filter(
    (group) =>
      matchesVisibility(group.visibility, user) &&
      resolveFooterGroupRoutes(group, user).length > 0,
  );
}

export function resolveFooterGroupRoutes(
  group: ShellFooterGroup,
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteDefinition[] {
  return group.routeIds
    .map(getShellRouteById)
    .filter((route) => matchesVisibility(route.footerVisibility, user));
}

export function resolveAccountMenuRoutes(
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteDefinition[] {
  return resolveRouteSet(ACCOUNT_MENU_ROUTE_IDS, user, (route) => route.accountVisibility);
}

export function resolveRailMenuRoutes(
  user?: Pick<SessionUser, "roles"> | null,
): ShellRouteDefinition[] {
  return resolveRouteSet(
    RAIL_MENU_ROUTE_IDS,
    user,
    (route) => route.footerVisibility ?? route.headerVisibility ?? route.accountVisibility ?? "all",
  );
}

export function resolveShellNavDrawerGroups(
  user?: Pick<SessionUser, "roles"> | null,
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