import type { ReactNode } from "react";
import { TeamShell } from "@/components/TeamShell";
import { canViewCreatorFeed } from "@/lib/creator/access";
import { requireTeamProfile } from "@/lib/auth/team";

export default async function TeamLayout({ children }: { children: ReactNode }) {
  const profile = await requireTeamProfile("/team");

  return <TeamShell profile={profile} creatorFeedAccess={await canViewCreatorFeed()}>{children}</TeamShell>;
}
