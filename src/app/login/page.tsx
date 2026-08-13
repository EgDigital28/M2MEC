import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell title="Log in" description="Access your M2MEC account.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
