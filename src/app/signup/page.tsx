import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create account"
      description="Sign up for M2MEC edge communications."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
