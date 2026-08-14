import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell title="Log in" description="Invite-only access for M2MEC accounts.">
      <AuthForm />
    </AuthShell>
  );
}
