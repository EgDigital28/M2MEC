import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { sortCatalog, type ExpenseComponent } from "@/lib/expenses/types";
import { createClient } from "@/lib/supabase/server";

type CreatePayload = {
  name?: string;
  sort_order?: number;
  is_active?: boolean;
};

export async function GET() {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_components")
    .select("id, name, sort_order, is_active, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Components fetch failed:", error);
    return NextResponse.json({ error: "Could not load components." }, { status: 500 });
  }

  return NextResponse.json({ components: sortCatalog(data as ExpenseComponent[]) });
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  let body: CreatePayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_components")
    .insert({
      name,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
    })
    .select("id, name, sort_order, is_active, created_at")
    .single();

  if (error) {
    console.error("Component create failed:", error);
    return NextResponse.json({ error: "Could not create component." }, { status: 500 });
  }

  return NextResponse.json({ component: data as ExpenseComponent });
}
