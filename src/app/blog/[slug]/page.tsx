import { notFound, redirect } from "next/navigation";

export default function BlogPostPage() {
  const postExists = false;

  if (!postExists) {
    notFound();
  }

  redirect("/journal");
}