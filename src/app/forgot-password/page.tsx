import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      description="Enter your email and we'll send a link to choose a new password."
    >
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
