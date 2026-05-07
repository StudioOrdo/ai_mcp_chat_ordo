import type Database from "better-sqlite3";
import type { User, RoleName } from "../core/entities/user";
import type { UserRepository, UserRecord } from "../core/use-cases/UserRepository";
import type { UserProfile } from "@/core/entities/user-profile";
import type { UserProfileRepository } from "@/core/use-cases/UserProfileRepository";
import { generateReferralCode } from "@/lib/referral/generate-code";

// ── Admin query types ─────────────────────────────────────────────────

export interface UserAdminFilters {
  search?: string;
  role?: RoleName;
  limit?: number;
  offset?: number;
}

export interface UserAdminRecord {
  id: string;
  email: string;
  name: string;
  roles: RoleName[];
  referralCode: string | null;
  createdAt: string | null;
  conversationCount: number;
}

export interface UserAdminDetailRecord extends UserAdminRecord {
  credential: string | null;
  affiliateEnabled: boolean;
  preferences: Array<{ key: string; value: string }>;
  referrals: Array<{
    id: string;
    referralCode: string;
    scannedAt: string | null;
    convertedAt: string | null;
    outcome: string | null;
  }>;
  recentConversations: Array<{
    id: string;
    title: string;
    lane: string;
    updatedAt: string;
  }>;
}

export class UserDataMapper implements UserRepository, UserProfileRepository {
  constructor(private db: Database.Database) {}

  async create(input: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    const id = `usr_${crypto.randomUUID()}`;
    this.db
      .prepare(`INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`)
      .run(id, input.email, input.name, input.passwordHash);

    // Assign AUTHENTICATED role
    this.db
      .prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, 'role_authenticated')`)
      .run(id);

    return {
      id,
      email: input.email,
      name: input.name,
      roles: ["AUTHENTICATED"],
    };
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = this.db
      .prepare(`SELECT id, email, name, password_hash FROM users WHERE email = ?`)
      .get(email) as
      | { id: string; email: string; name: string; password_hash: string | null }
      | undefined;

    if (!row) return null;

    const roles = this.getRoles(row.id);

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      roles,
    };
  }

  async findById(id: string): Promise<User | null> {
    const row = this.db
      .prepare(`SELECT id, email, name FROM users WHERE id = ?`)
      .get(id) as
      | { id: string; email: string; name: string }
      | undefined;

    if (!row) return null;

    const roles = this.getRoles(row.id);

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      roles,
    };
  }

  async findProfileById(id: string): Promise<UserProfile | null> {
    const row = this.db
      .prepare(
        `SELECT id, email, name, credential, affiliate_enabled, referral_code FROM users WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          email: string;
          name: string;
          credential: string | null;
          affiliate_enabled: number | null;
          referral_code: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    const roles = this.getRoles(row.id);
    const normalizedProfile = this.ensureDefaultAffiliateAccess({
      id: row.id,
      email: row.email,
      name: row.name,
      credential: row.credential,
      affiliateEnabled: row.affiliate_enabled === 1,
      referralCode: row.referral_code,
      roles,
    });

    return normalizedProfile;
  }

  async updateProfile(
    id: string,
    input: { name: string; email: string; credential: string | null },
  ): Promise<UserProfile> {
    this.db
      .prepare(`UPDATE users SET name = ?, email = ?, credential = ? WHERE id = ?`)
      .run(input.name, input.email, input.credential, id);

    const updated = await this.findProfileById(id);
    if (!updated) {
      throw new Error(`User profile not found after update: ${id}`);
    }
    return updated;
  }

  /** Adapter-specific method for mock auth — NOT part of UserRepository port */
  public findByActiveRole(activeRoleName: RoleName): User | null {
    const mockUserRow = this.db
      .prepare(
        `
            SELECT u.id, u.email, u.name 
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = ?
        `,
      )
      .get(activeRoleName) as
      | { id: string; email: string; name: string }
      | undefined;

    if (!mockUserRow) return null;

    const roles = this.getRoles(mockUserRow.id);

    return {
      id: mockUserRow.id,
      email: mockUserRow.email,
      name: mockUserRow.name,
      roles,
    };
  }

  // ── Admin query methods ─────────────────────────────────────────────

  async listForAdmin(filters: UserAdminFilters): Promise<UserAdminRecord[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      clauses.push("(u.name LIKE ? OR u.email LIKE ?)");
      const term = `%${filters.search}%`;
      params.push(term, term);
    }
    if (filters.role) {
      clauses.push("EXISTS (SELECT 1 FROM user_roles ur2 JOIN roles r2 ON ur2.role_id = r2.id WHERE ur2.user_id = u.id AND r2.name = ?)");
      params.push(filters.role);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const limit = typeof filters.limit === "number" ? filters.limit : 100;
    const offset = typeof filters.offset === "number" ? filters.offset : 0;

    const rows = this.db
      .prepare(
        `SELECT u.id, u.email, u.name, u.referral_code, u.created_at,
                (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id) AS conversation_count
         FROM users u
         ${where}
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Array<{
        id: string;
        email: string;
        name: string;
        referral_code: string | null;
        created_at: string | null;
        conversation_count: number;
      }>;

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      roles: this.getRoles(row.id),
      referralCode: row.referral_code,
      createdAt: row.created_at,
      conversationCount: row.conversation_count,
    }));
  }

  async countForAdmin(filters: UserAdminFilters): Promise<number> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      clauses.push("(u.name LIKE ? OR u.email LIKE ?)");
      const term = `%${filters.search}%`;
      params.push(term, term);
    }
    if (filters.role) {
      clauses.push("EXISTS (SELECT 1 FROM user_roles ur2 JOIN roles r2 ON ur2.role_id = r2.id WHERE ur2.user_id = u.id AND r2.name = ?)");
      params.push(filters.role);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const row = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM users u ${where}`)
      .get(...params) as { cnt: number };

    return row.cnt;
  }

  async countByRole(filters: Omit<UserAdminFilters, "role">): Promise<Record<string, number>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      clauses.push("(u.name LIKE ? OR u.email LIKE ?)");
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = this.db
      .prepare(
        `SELECT r.name, COUNT(DISTINCT ur.user_id) AS cnt
         FROM roles r
         LEFT JOIN user_roles ur ON r.id = ur.role_id
         LEFT JOIN users u ON ur.user_id = u.id ${where ? `AND ${clauses.join(" AND ")}` : ""}
         GROUP BY r.name`,
      )
      .all(...params) as Array<{ name: string; cnt: number }>;

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.name] = row.cnt;
    }
    return counts;
  }

  async findByIdForAdmin(userId: string): Promise<UserAdminDetailRecord | null> {
    const row = this.db
      .prepare(
        `SELECT u.id, u.email, u.name, u.referral_code, u.created_at,
                u.credential, u.affiliate_enabled,
                (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id) AS conversation_count
         FROM users u WHERE u.id = ?`,
      )
      .get(userId) as
      | {
          id: string;
          email: string;
          name: string;
          referral_code: string | null;
          created_at: string | null;
          credential: string | null;
          affiliate_enabled: number | null;
          conversation_count: number;
        }
      | undefined;

    if (!row) return null;

    const roles = this.getRoles(row.id);

    const preferences = this.db
      .prepare(`SELECT key, value FROM user_preferences WHERE user_id = ? ORDER BY key`)
      .all(row.id) as Array<{ key: string; value: string }>;

    const referrals = this.db
      .prepare(
        `SELECT id, referral_code, scanned_at, converted_at, outcome
         FROM referrals WHERE referrer_user_id = ? ORDER BY created_at DESC`,
      )
      .all(row.id) as Array<{
        id: string;
        referral_code: string;
        scanned_at: string | null;
        converted_at: string | null;
        outcome: string | null;
      }>;

    const recentConversations = this.db
      .prepare(
        `SELECT id, title, lane, updated_at
         FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5`,
      )
      .all(row.id) as Array<{
        id: string;
        title: string;
        lane: string;
        updated_at: string;
      }>;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      roles,
      referralCode: row.referral_code,
      createdAt: row.created_at,
      conversationCount: row.conversation_count,
      credential: row.credential,
      affiliateEnabled: row.affiliate_enabled === 1,
      preferences,
      referrals: referrals.map((r) => ({
        id: r.id,
        referralCode: r.referral_code,
        scannedAt: r.scanned_at,
        convertedAt: r.converted_at,
        outcome: r.outcome,
      })),
      recentConversations: recentConversations.map((c) => ({
        id: c.id,
        title: c.title,
        lane: c.lane,
        updatedAt: c.updated_at,
      })),
    };
  }

  async updateRole(userId: string, roleId: string): Promise<void> {
    // Remove all existing roles and set the new one
    this.db.prepare(`DELETE FROM user_roles WHERE user_id = ?`).run(userId);
    this.db.prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`).run(userId, roleId);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    this.db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, userId);
  }

  async findPasswordCredentialByUserId(userId: string): Promise<{ id: string; passwordHash: string | null } | null> {
    const row = this.db
      .prepare(`SELECT id, password_hash FROM users WHERE id = ?`)
      .get(userId) as { id: string; password_hash: string | null } | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      passwordHash: row.password_hash,
    };
  }

  hasCredentialedAdminOwner(): boolean {
    const row = this.db
      .prepare(`
        SELECT 1
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'ADMIN'
          AND u.password_hash IS NOT NULL
          AND trim(u.password_hash) <> ''
        LIMIT 1
      `)
      .get() as { "1": number } | undefined;

    return Boolean(row);
  }

  async toggleAffiliate(userId: string, enabled: boolean): Promise<void> {
    if (enabled) {
      const existing = this.db
        .prepare(`SELECT referral_code FROM users WHERE id = ?`)
        .get(userId) as { referral_code: string | null } | undefined;
      const code = existing?.referral_code ?? generateReferralCode();
      this.db
        .prepare(`UPDATE users SET affiliate_enabled = 1, referral_code = ? WHERE id = ?`)
        .run(code, userId);
    } else {
      this.db
        .prepare(`UPDATE users SET affiliate_enabled = 0 WHERE id = ?`)
        .run(userId);
    }
  }

  private getRoles(userId: string): RoleName[] {
    const rolesRows = this.db
      .prepare(
        `SELECT r.name
         FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
      )
      .all(userId) as { name: RoleName }[];

    return rolesRows.map((r) => r.name);
  }

  private ensureDefaultAffiliateAccess(profile: UserProfile): UserProfile {
    const shouldProvisionAdminReferral = profile.roles.includes("ADMIN")
      && (!profile.affiliateEnabled || !profile.referralCode);

    if (!shouldProvisionAdminReferral) {
      return profile;
    }

    const referralCode = profile.referralCode ?? generateReferralCode();

    this.db
      .prepare(`UPDATE users SET affiliate_enabled = 1, referral_code = ? WHERE id = ?`)
      .run(referralCode, profile.id);

    return {
      ...profile,
      affiliateEnabled: true,
      referralCode,
    };
  }
}
