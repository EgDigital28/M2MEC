import type { ReactNode } from "react";
import { TeamShell } from "@/components/TeamShell";
import { requireTeamProfile } from "@/lib/auth/team";

export default async function TeamLayout({ children }: { children: ReactNode }) {
  const profile = await requireTeamProfile("/team");

  return <TeamShell profile={profile}>{children}</TeamShell>;
}
