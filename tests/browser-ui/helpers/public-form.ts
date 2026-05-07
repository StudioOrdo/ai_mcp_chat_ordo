import type { Page } from "@playwright/test";

const REGISTER_FORM_STARTED_AT_FIELD = "formStartedAt";
const SESSION_COOKIE_NAME = "lms_session_token";
const INSTALL_COOKIE_NAME = "ordo_installed";

export async function ensureInstalledCookie(page: Page) {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:34123";
  const { hostname } = new URL(baseUrl);
  const cookies = await page.context().cookies(baseUrl);

  if (cookies.some((cookie) => cookie.name === INSTALL_COOKIE_NAME && cookie.value === "1")) {
    return;
  }

  await page.context().addCookies([{
    name: INSTALL_COOKIE_NAME,
    value: "1",
    domain: hostname,
    path: "/",
    httpOnly: false,
    secure: baseUrl.startsWith("https://"),
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
  }]);
}

export async function backdateRegisterFormStart(page: Page, offsetMs = 2_000) {
  await ensureInstalledCookie(page);

  await page.route("**/api/auth/register", async (route) => {
    const postData = route.request().postData();

    if (!postData) {
      await route.continue();
      return;
    }

    try {
      const payload = JSON.parse(postData) as Record<string, unknown>;
      payload[REGISTER_FORM_STARTED_AT_FIELD] = String(Date.now() - offsetMs);
      await route.continue({ postData: JSON.stringify(payload) });
    } catch {
      await route.continue();
    }
  });
}

export async function finishRegisterNavigation(page: Page, fallbackHref = "/") {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const hasSessionCookie = (await page.context().cookies()).some((cookie) => cookie.name === SESSION_COOKIE_NAME);
    const currentUrl = new URL(page.url());

    if (hasSessionCookie && currentUrl.pathname !== "/register") {
      await page.waitForLoadState("networkidle");
      return;
    }

    if (hasSessionCookie && currentUrl.pathname === "/register") {
      await page.goto(fallbackHref);
      await page.waitForLoadState("networkidle");
      return;
    }

    await page.waitForTimeout(200);
  }

  await page.goto(fallbackHref);
  await page.waitForLoadState("networkidle");
}
