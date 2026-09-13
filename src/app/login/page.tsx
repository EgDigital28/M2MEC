import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell title="Log in" description="Invite-only access for M2MEC accounts.">
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <AuthForm />
      </Suspense>
    </AuthShell>
  );
}
