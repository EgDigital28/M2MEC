import type { UserTier } from "@/lib/tiers";

export type InviteActivityRow = {
  profile_id: string;
  email: string;
  display_name: string | null;
  tier: UserTier;
  invited_at: string;
  registered_at: string | null;
  suspended_at: string | null;
  invite_count: number;
  last_invited_at: string;
};

export type InviteEvent = {
  id: string;
  email: string;
  tier: UserTier;
  profile_id: string | null;
  invited_by: string | null;
  created_at: string;
};
