import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-secondary text-sm font-bold text-white shadow-lg shadow-accent/20">
            M2
          </span>
          <span className="text-lg font-semibold tracking-tight">M2MEC</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface-elevated p-8 shadow-2xl shadow-black/20">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create account
          </h1>
          <p className="mt-2 text-sm text-muted">
            Sign up for M2MEC edge communications.
          </p>
          <div className="mt-8">
            <AuthForm mode="signup" />
          </div>
        </div>
      </div>
    </div>
  );
}
