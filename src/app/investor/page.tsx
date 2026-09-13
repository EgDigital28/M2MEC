import { InvestorOverview } from "@/components/InvestorOverview";
import { getProfileDisplayName } from "@/lib/auth/display-name";
import { requireInvestorProfile } from "@/lib/auth/investor";

export default async function InvestorPage() {
  const profile = await requireInvestorProfile("/investor");
  const displayName = getProfileDisplayName(profile);

  return <InvestorOverview displayName={displayName} />;
}
