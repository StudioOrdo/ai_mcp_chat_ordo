import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { dollarsToCents } from "@/lib/offers/offer-format";
import { getOfferService } from "@/lib/offers/offer-service";
import { mapErrorToResponse } from "@/core/common/errors";
import { isOfferBillingKind, isOfferVisibility } from "@/core/entities/offer";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    const form = await request.formData();
    const billingKind = String(form.get("billingKind") ?? "fixed");
    const visibility = String(form.get("visibility") ?? "private");

    await getOfferService().createDraft(
      { userId: user.id, role: user.roles[0] ?? "ANONYMOUS" },
      {
        title: String(form.get("title") ?? ""),
        audience: String(form.get("audience") ?? ""),
        promise: String(form.get("promise") ?? ""),
        summary: String(form.get("summary") ?? ""),
        description: String(form.get("description") ?? ""),
        priceCents: dollarsToCents(form.get("price")),
        estimatedMinutes: parseInteger(form.get("estimatedMinutes")),
        billingKind: isOfferBillingKind(billingKind) ? billingKind : "fixed",
        visibility: isOfferVisibility(visibility) ? visibility : "private",
        ctaLabel: String(form.get("ctaLabel") ?? ""),
      },
    );

    return NextResponse.redirect(new URL("/offers", request.url), { status: 303 });
  } catch (error) {
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

function parseInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
