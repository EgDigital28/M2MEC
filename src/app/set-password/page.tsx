import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SetPasswordForm } from "@/components/SetPasswordForm";

type SetPasswordPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const { reason } = await searchParams;
  const isRecovery = reason === "recovery";

  return (
    <AuthShell
      title={isRecovery ? "Choose a new password" : "Complete your registration"}
      description={
        isRecovery
          ? "Enter a new password for your M2MEC account."
          : "Choose a password and enter your name to finish setting up your account."
      }
    >
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <SetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
