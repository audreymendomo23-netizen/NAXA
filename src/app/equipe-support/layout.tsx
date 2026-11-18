import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SupportAgentLayout({ children }: { children: ReactNode }) {
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) redirect("/connexion?retour=%2Fequipe-support");

  const { data: agent, error } = await sb.from("support_agents")
    .select("first_name,last_name,status,must_change_password")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !agent || agent.status !== "active") redirect("/");
  if (agent.must_change_password) redirect("/activation-agent");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/equipe-support" className="flex items-center gap-3">
            <Logo taille={34} />
            <span className="text-sm font-extrabold">Service client NAXA</span>
          </Link>
          <div className="text-right">
            <p className="text-sm font-bold">{agent.first_name} {agent.last_name}</p>
            <p className="text-xs text-emerald-700">Agent actif</p>
          </div>
        </div>
        <nav className="mx-auto mt-3 flex max-w-7xl flex-wrap gap-2 text-sm">
          <Link href="/equipe-support" className="rounded-full bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">Tableau de bord</Link>
          <Link href="/equipe-support" className="rounded-full px-3 py-2 text-slate-600 hover:bg-slate-100">File centrale</Link>
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </main>
  );
}
