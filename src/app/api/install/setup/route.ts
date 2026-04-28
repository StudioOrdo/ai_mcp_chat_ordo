import { NextResponse } from "next/server";
import { ConfigurationService } from "@/lib/config/ConfigurationService";
import { getUserDataMapper } from "@/adapters/RepositoryFactory";
import { BcryptHasher } from "@/adapters/BcryptHasher";
import { ensureDbSchema } from "@/lib/db";
import { queuePendingLifecycleEvent } from "@/lib/lifecycle/lifecycle-queue";
import { markOnboardedWithoutEmission } from "@/lib/lifecycle/onboarded";

export async function POST(request: Request) {
  try {
    const isInitialized = ConfigurationService.isSystemInitialized();
    if (isInitialized) {
      return NextResponse.json(
        { error: "System is already initialized." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { anthropicKey, openAiKey, adminEmail, adminPassword } = body;

    if (!anthropicKey || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // 1. Ensure DB schema exists
    ensureDbSchema();

    // 2. Save API Keys to SQLite
    ConfigurationService.setString("ANTHROPIC_API_KEY", anthropicKey);
    if (openAiKey) {
      ConfigurationService.setString("OPENAI_API_KEY", openAiKey);
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
