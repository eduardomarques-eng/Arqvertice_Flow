import { redirect } from "next/navigation";

export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; next?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params?.updated === "1") q.set("updated", "1");
  if (params?.next) q.set("next", params.next);
  const queryStr = q.toString();
  redirect(queryStr ? `/?${queryStr}` : "/");
}
