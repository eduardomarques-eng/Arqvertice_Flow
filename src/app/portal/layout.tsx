import type { ReactNode } from "react";
import { SessionGuard } from "@/components/auth/session-guard";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SessionGuard />
      {children}
    </>
  );
}

