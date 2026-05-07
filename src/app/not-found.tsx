import { getInstanceIdentity } from "@/lib/config/instance";
import { PublicStatusPage } from "@/components/public/PublicStatusPage";

export default function NotFound() {
  const identity = getInstanceIdentity();

  return (
    <PublicStatusPage
      brandName={identity.name}
      eyebrow="Not found"
      title="That route is not available"
      description="The page or asset you requested is missing, moved, or no longer available in this workspace."
      primaryAction={{ href: "/", label: "Return home" }}
      secondaryAction={{ href: "/feed", label: "View feed" }}
    />
  );
}
