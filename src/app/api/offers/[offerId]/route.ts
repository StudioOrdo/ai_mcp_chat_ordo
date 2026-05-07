import { NextResponse } from "next/server";

import { isOfferBillingKind, isOfferVisibility } from "@/core/entities/offer";
import { getSessionUser } from "@/lib/auth";
import { dollarsToCents } from "@/lib/offers/offer-format";
import { getOfferService } from "@/lib/offers/offer-service";
import { mapErrorToResponse, ValidationError } from "@/core/common/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  try {
    const user = await getSessionUser();
    const { offerId } = await params;
    const form = await request.formData();
    const action = String(form.get("action") ?? "");
    const actor = { userId: user.id, role: user.roles[0] ?? "ANONYMOUS" };

    if (action === "publish") {
      await getOfferService().publishOffer(actor, offerId);
    } else if (action === "archive") {
      await getOfferService().archiveOffer(actor, offerId);
    } else if (action === "update") {
      const billingKind = String(form.get("billingKind") ?? "fixed");
      const visibility = String(form.get("visibility") ?? "private");

      await getOfferService().updateOffer(actor, {
        offerId,
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
      });
    } else {
      throw new ValidationError("Unsupported offer action.");
    }

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
