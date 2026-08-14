import { redirect } from "next/navigation";
import { ExpensesAdmin } from "@/components/ExpensesAdmin";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function TeamExpensesPage() {
  const profile = await getCurrentProfile();

  if (profile?.tier !== "admin") {
    redirect("/team");
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Expenses</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Log expense line items by cost center and component. Quarter is calculated automatically
          from the expense date.
        </p>
      </section>

      <ExpensesAdmin />
    </div>
  );
}
