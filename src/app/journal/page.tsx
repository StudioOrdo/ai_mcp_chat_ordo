import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

export default function JournalPage() {
  notFound();
}
