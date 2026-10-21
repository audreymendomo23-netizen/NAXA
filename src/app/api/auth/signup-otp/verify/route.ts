import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

async function findAuthUserId(email: string): Promise<string | null> {
  const admin = supabaseAdmin();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = (data.users ?? []).find((candidate) => candidate.email?.trim().toLowerCase() === email);
    if (user) return user.id;
    if ((data.users ?? []).length < 1000) return null;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const token = String(body.token ?? "").trim().replace(/\s/g, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(token)) {
      return NextResponse.json({ ok: false, error: "Code incorrect ou expiré." }, { status: 400 });
    }

    const userId = await findAuthUserId(email);
    if (!userId) return NextResponse.json({ ok: false, error: "Code incorrect ou expiré." }, { status: 400 });

    const response = NextResponse.json({ ok: true });
    const supabase = supabaseServer(response);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.session) {
      if (error) console.error("signup OTP verification failed", { code: error.code, status: error.status, message: error.message });
      return NextResponse.json({ ok: false, error: "Code incorrect ou expiré. Vérifiez le dernier code reçu ou demandez-en un nouveau." }, { status: 400 });
    }
    return response;
  } catch (error) {
    console.error("signup OTP verification endpoint failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Vérification indisponible. Réessayez dans un instant." }, { status: 503 });
  }
}
