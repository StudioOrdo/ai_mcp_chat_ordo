"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RedirectAndSetCookie({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    // Set a cookie so the Edge middleware knows we are installed
    document.cookie = "ordo_installed=1; path=/; max-age=31536000"; // 1 year
    router.replace(to);
  }, [router, to]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-neutral-500 animate-pulse">Redirecting to Dashboard...</p>
    </div>
  );
}
