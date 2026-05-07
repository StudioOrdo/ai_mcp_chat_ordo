import { NextResponse } from "next/server";
import {
  parseLegacyProviderSettingsInput,
  parseProviderSettingsUpdateInput,
  providerSettingsService,
  isProviderSettingsFailure,
} from "@/lib/ai/providers/provider-settings-service";
import { guardInstallMutation } from "@/lib/appliance/install/install-token";
import { getUserDataMapper } from "@/adapters/RepositoryFactory";
import { BcryptHasher } from "@/adapters/BcryptHasher";
import { ensureDbSchema } from "@/lib/db";
import { queuePendingLifecycleEvent } from "@/lib/lifecycle/lifecycle-queue";
import { markOnboardedWithoutEmission } from "@/lib/lifecycle/onboarded";

export async function POST(request: Request) {
  try {
    const body = await request.json() as unknown;
    const guard = guardInstallMutation(request, body);
    if (!guard.ok) {
      return guard.response;
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be an object." },
        { status: 400 }
      );
    }
    const { adminEmail, adminPassword } = body as {
      adminEmail?: string;
      adminPassword?: string;
    };

    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const providerSettings = parseLegacyProviderSettingsInput(body)
      ?? parseProviderSettingsUpdateInput(body);
    if (isProviderSettingsFailure(providerSettings)) {
      return NextResponse.json(
        { error: providerSettings.error.message },
        { status: providerSettings.error.status }
      );
    }

    // 1. Ensure DB schema exists
    ensureDbSchema();

    // 2. Validate and save provider settings to SQLite
    const providerResult = await providerSettingsService.applyInstallSettings(providerSettings);
    if (!providerResult.ok) {
      return NextResponse.json(
        { error: providerResult.error.message },
        { status: providerResult.error.status }
      );
    }

    // 3. Create initial Admin User
    const userDataMapper = getUserDataMapper();
    const hasher = new BcryptHasher();
    const passwordHash = await hasher.hash(adminPassword);

    // Check if user exists (edge case)
    const existingUser = await userDataMapper.findByEmail(adminEmail);
    if (!existingUser) {
      const user = await userDataMapper.create({
        email: adminEmail,
        name: "Admin",
        passwordHash,
      });

      // Update role to ADMIN
      await userDataMapper.updateRole(user.id, "role_admin");
    } else {
      if (!existingUser.passwordHash) {
        await userDataMapper.updatePasswordHash(existingUser.id, passwordHash);
      }
      if (!existingUser.roles.includes("ADMIN")) {
        await userDataMapper.updateRole(existingUser.id, "role_admin");
      }
    }

    // 4. Log the new admin user in
    const { login } = await import("@/lib/auth");
    const { cookies } = await import("next/headers");

    // Suppress the generic `onboarded` coach card for the install admin so
    // they only see the install-specific `installed` card emitted below.
    const adminUser = await userDataMapper.findByEmail(adminEmail);
    if (adminUser) {
      await markOnboardedWithoutEmission(adminUser.id);
    }

    const result = await login({ email: adminEmail, password: adminPassword });

    const cookieStore = await cookies();
    cookieStore.set("lms_session_token", result.sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.REQUIRE_SECURE_COOKIES !== "false",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // 5. Emit system_installed lifecycle event for the admin. Consumed by
    //    useLifecycleContext on the first authenticated chat render.
    await queuePendingLifecycleEvent(result.user.id, {
      variant: "installed",
      occurredAt: new Date().toISOString(),
      actor: "System",
      detail: "Workspace provisioned and ready.",
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[Install Setup Error]", error);
    const message =
      error instanceof Error ? error.message : "Failed to initialize.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
