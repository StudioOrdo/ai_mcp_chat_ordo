import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { mapErrorToResponse, ValidationError } from "@/core/common/errors";
import {
  getTrackedLinkService,
} from "@/lib/tracked-links/tracked-link-service";
import {
  buildTrackedLinkPath,
  buildTrackedLinkQrPath,
} from "@/lib/tracked-links/tracked-link-origin";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    const contentType = request.headers.get("content-type") ?? "";
    const input = contentType.includes("application/json")
      ? await request.json() as Record<string, unknown>
      : Object.fromEntries((await request.formData()).entries());

    const actor = { userId: user.id, role: user.roles[0] ?? "ANONYMOUS" };
    const targetKind = String(input.targetKind ?? input.target_kind ?? "");
    const service = getTrackedLinkService();
    const link = targetKind === "offer"
      ? await service.createForOffer(
          actor,
          {
            offerId: String(input.targetId ?? input.target_id ?? input.offerId ?? ""),
            label: typeof input.label === "string" ? input.label : null,
            purpose: typeof input.purpose === "string" ? input.purpose : null,
            createdFromConversationId: typeof input.createdFromConversationId === "string"
              ? input.createdFromConversationId
              : null,
          },
        )
      : targetKind === "content_item"
        ? await service.createForContentItem(
            actor,
            {
              contentId: String(input.targetId ?? input.target_id ?? input.contentId ?? ""),
              label: typeof input.label === "string" ? input.label : null,
              purpose: typeof input.purpose === "string" ? input.purpose : null,
              createdFromConversationId: typeof input.createdFromConversationId === "string"
                ? input.createdFromConversationId
                : null,
            },
          )
      : targetKind === "url"
        ? await service.createForPublicUrl(
            actor,
            {
              destinationUrl: String(input.destinationUrl ?? input.destination_url ?? ""),
              label: String(input.label ?? ""),
              purpose: typeof input.purpose === "string" ? input.purpose : null,
              targetKind: "url",
              createdFromConversationId: typeof input.createdFromConversationId === "string"
                ? input.createdFromConversationId
                : null,
            },
          )
        : (() => {
            throw new ValidationError("Only offer, content item, and owned public URL tracked-link creation is supported by this endpoint.");
          })();

    const payload = {
      trackedLink: {
        id: link.id,
        code: link.code,
        targetKind: link.targetKind,
        targetId: link.targetId,
        destinationUrl: link.destinationUrl,
        trackedUrl: buildTrackedLinkPath(link.code),
        qrCodeUrl: buildTrackedLinkQrPath(link.code),
        status: link.status,
      },
    };

    if (contentType.includes("application/json")) {
      return NextResponse.json(payload, { status: 201 });
    }

    return NextResponse.redirect(new URL(link.targetKind === "content_item"
      ? `/studio/content/${encodeURIComponent(link.targetId)}`
      : `/offers?offerId=${encodeURIComponent(link.targetId)}`, request.url), { status: 303 });
  } catch (error) {
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
