import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export default function EmailVerifiedPage() {
  return (
    <AuthShell
      title="Email verified"
      description="Your address is confirmed and you're signed in."
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-300">
          Welcome to M2MEC — your account is ready to use.
        </div>

        <p className="text-sm text-muted">
          You can explore the site or log in again anytime from another device
          using the same email and password.
        </p>

        <Link
          href="/"
          className="block w-full rounded-full bg-foreground px-4 py-3 text-center text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Continue to M2MEC
        </Link>

        <p className="text-center text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Account settings
          </Link>{" "}
          coming soon.
        </p>
      </div>
    </AuthShell>
  );
}
