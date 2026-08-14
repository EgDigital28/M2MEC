import { AuthShell } from "@/components/AuthShell";
import { SetPasswordForm } from "@/components/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <AuthShell
      title="Set your password"
      description="Almost done — choose a password for your M2MEC account."
    >
      <SetPasswordForm />
    </AuthShell>
  );
}
