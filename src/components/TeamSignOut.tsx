"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TeamSignOutProps = {
  className?: string;
};

export function TeamSignOut({ className }: TeamSignOutProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={
        className ??
        "text-sm text-muted transition-colors hover:text-foreground"
      }
    >
      Sign out
    </button>
  );
}
