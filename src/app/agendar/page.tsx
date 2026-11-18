import { AgendarClient } from "@/components/booking/agendar-client";

export const metadata = { title: "Agendar Reunião — ArqVértice Studio" };
export const dynamic = "force-dynamic";

export default function AgendarPage() {
  return <AgendarClient />;
}
