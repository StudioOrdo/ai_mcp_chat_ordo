import type { Offer } from "@/core/entities/offer";

export function formatOfferPrice(offer: Pick<Offer, "billingKind" | "priceCents" | "currency">): string {
  if (offer.billingKind === "free") {
    return "Free";
  }
  if (offer.billingKind === "contact") {
    return "Contact for price";
  }
  if (typeof offer.priceCents === "number" && offer.priceCents > 0) {
    const price = new Intl.NumberFormat("en", {
      style: "currency",
      currency: offer.currency,
      maximumFractionDigits: 0,
    }).format(offer.priceCents / 100);

    return offer.billingKind === "hourly" ? `${price}/hr` : price;
  }

  return "Price required";
}

export function dollarsToCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value.replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}
