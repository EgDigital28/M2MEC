import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const { email } = await searchParams;

  return (
    <AuthShell
      title="Check your email"
      description="We sent a confirmation link to finish creating your account."
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-4 text-sm">
          {email ? (
            <p>
              Look for an email at{" "}
              <span className="font-semibold text-foreground">{email}</span>.
              Click the confirmation link inside to verify your address.
            </p>
          ) : (
            <p>
              Look for a confirmation email from M2MEC. Click the link inside to
              verify your address.
            </p>
          )}
        </div>

        <ul className="space-y-2 text-sm text-muted">
          <li>• The link expires after 24 hours.</li>
          <li>• Check spam if you don&apos;t see it in a few minutes.</li>
          <li>• You can close this tab — your inbox has the next step.</li>
        </ul>

        <Link
          href="/login"
          className="block w-full rounded-full bg-foreground px-4 py-3 text-center text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Go to log in
        </Link>

        <p className="text-center text-sm text-muted">
          Wrong email?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Sign up again
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
