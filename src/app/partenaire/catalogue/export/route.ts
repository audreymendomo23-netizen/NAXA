import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function cell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export async function GET(request: Request) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/connexion?retour=/partenaire/catalogue/export", request.url));
  const { data: memberships, error: memberError } = await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(status)").eq("user_id", auth.user.id)
    .in("member_role", ["owner", "manager", "operator"]);
  if (memberError || !memberships?.length) return new NextResponse("Accès refusé", { status: 403 });
  const ids = (memberships as any[]).filter((m) => m.partners?.status === "active").map((m) => m.partner_id);
  if (!ids.length) return new NextResponse("Aucun partenaire actif", { status: 403 });
  const { data, error } = await sb.from("partner_products")
    .select("partner_id,universe_slug,name,price_fcfa,stock_quantity,category,brand,description,unit_label,photo_url,status,expires_at")
    .in("partner_id", ids).order("name").limit(5000);
  if (error) return new NextResponse("Catalogue indisponible", { status: 503 });
  const header = ["partner_id","universe_slug","name","price_fcfa","stock_quantity","category","brand","description","unit_label","photo_url","status","expires_at"];
  const lines = [header, ...(data ?? []).map((row: any) => header.map((key) => row[key]))]
    .map((row) => row.map(cell).join(";")).join("\r\n");
  return new NextResponse("\uFEFF" + lines, { headers: {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": 'attachment; filename="naxa-catalogue.csv"',
    "cache-control": "no-store",
  }});
}
