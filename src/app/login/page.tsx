import { redirect } from "next/navigation";

export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const params = await searchParams;
  if (params?.updated === "1") {
    redirect("/?updated=1");
  }
  redirect("/");
}
