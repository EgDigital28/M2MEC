import type { ReactNode } from "react";
import { InvestorShell } from "@/components/InvestorShell";
import { requireInvestorProfile } from "@/lib/auth/investor";

export default async function InvestorLayout({ children }: { children: ReactNode }) {
  const profile = await requireInvestorProfile("/investor");

  return <InvestorShell profile={profile}>{children}</InvestorShell>;
}
