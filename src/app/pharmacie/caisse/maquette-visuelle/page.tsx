import type { ReactNode } from "react";

const menu = [
  { icon: "⌂", label: "Tableau de bord", active: true },
  { icon: "♙", label: "Clients et Assurances" },
  { icon: "▤", label: "Historique des ventes" },
  { icon: "◷", label: "Prise / fin de service" },
  { icon: "▥", label: "Rapports & Performances" },
  { icon: "♙", label: "Profil" },
  { icon: "↪", label: "Déconnexion" },
];

const stats = [
  { label: "Mes ventes aujourd’hui", value: "—", note: "Valeur à connecter", icon: "↗", tone: "green" },
  { label: "Tickets émis", value: "—", note: "Nombre du jour", icon: "▤", tone: "yellow" },
  { label: "Panier moyen", value: "—", note: "Calcul sur mes ventes", icon: "◉", tone: "blue" },
  { label: "Session de caisse", value: "Non renseignée", note: "État de la session", icon: "◷", tone: "purple" },
];

function Mark({ children, tone = "green" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    green: "bg-[#e5f5eb] text-[#0b6b3b]",
    yellow: "bg-[#fff5b9] text-[#6e5900]",
    blue: "bg-[#e5efff] text-[#1d4ed8]",
    purple: "bg-[#f0e8ff] text-[#6d28d9]",
    red: "bg-[#fee8e7] text-[#b42318]",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={"inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-black " + (tones[tone] || tones.green)}>{children}</span>;
}

function StaticButton({ children, kind = "primary" }: { children: ReactNode; kind?: "primary" | "light" | "danger" }) {
  const styles = {
    primary: "bg-[#0b3d26] text-white shadow-sm",
    light: "border border-slate-200 bg-white text-slate-700",
    danger: "border border-red-200 bg-red-50 text-red-800",
  };
  return <span aria-hidden="true" className={"inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold " + styles[kind]}>{children}</span>;
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: string }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-extrabold text-slate-900">{title}</h3>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
      {action && <StaticButton kind="light">{action}</StaticButton>}
    </div>
    {children}
  </section>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center">
    <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl text-slate-400 shadow-sm">⌕</span>
    <p className="font-bold text-slate-800">{title}</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
  </div>;
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="mb-4 flex items-start gap-3">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0b3d26] text-sm font-black text-white">{number}</span>
    <div><h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
  </div>;
}

function MiniBars() {
  const heights = [34, 49, 39, 67, 53, 78, 57, 88, 65, 72, 45, 61];
  return <div className="flex h-40 items-end gap-2 border-b border-l border-slate-200 px-2 pb-0 pt-4" aria-label="Aperçu décoratif d'une courbe horaire">
    {heights.map((h, i) => <div key={i} className="flex h-full flex-1 items-end"><span className="w-full rounded-t-md bg-[#198754]" style={{ height: h + "%" }} /></div>)}
  </div>;
}

function PlaceholderRows({ rows }: { rows: { title: string; detail: string; status: string; tone?: string }[] }) {
  return <div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.title} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
    <div className="flex min-w-0 items-center gap-3"><Mark tone={row.tone || "slate"}>•</Mark><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{row.title}</p><p className="mt-1 text-xs text-slate-500">{row.detail}</p></div></div>
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{row.status}</span>
  </div>)}</div>;
}

export default function CaisseMaquetteVisuellePage() {
  return <main className="min-h-screen bg-[#f3f7f4] text-slate-800">
    <div className="mx-auto max-w-[1600px] p-3 sm:p-5 lg:p-6">
      <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-extrabold">Maquette visuelle uniquement — aucun bouton n’exécute d’action.</p>
        <p className="mt-1">Les valeurs « — », profils, listes et états illustrés sont des exemples de présentation, pas des données de pharmacie.</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl bg-[#0b3d26] p-4 text-white shadow-lg lg:sticky lg:top-4">
          <div className="mb-6 flex items-center gap-3 border-b border-white/15 px-1 pb-5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ffe23d] text-xl font-black text-[#0b3d26]">N</div>
            <div><p className="text-xl font-black tracking-wide">NAXA</p><p className="text-xs text-emerald-100">Gestion de pharmacie</p></div>
          </div>
          <div className="mb-3 rounded-xl bg-white/10 p-3">
            <p className="text-xs uppercase tracking-wider text-emerald-100">Espace de travail</p>
            <p className="mt-1 font-bold">Compte caisse</p>
            <p className="mt-1 text-xs text-emerald-100">Pharmacie · nom à connecter</p>
          </div>
          <nav aria-label="Aperçu des sept entrées du panneau latéral" className="space-y-1">
            {menu.map((item, index) => <div key={item.label} className={"flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold " + (item.active ? "bg-[#ffe23d] text-[#0b3d26]" : item.label === "Déconnexion" ? "mt-5 border border-white/20 text-white" : "text-white/90")}>
              <span className="grid w-6 shrink-0 place-items-center text-lg" aria-hidden="true">{item.icon}</span><span className="flex-1">{item.label}</span>
              {index === 1 && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-[#0b3d26]">—</span>}
              {index === 3 && <span className="rounded-full bg-[#ffe23d] px-2 py-0.5 text-xs font-black text-[#0b3d26]">État</span>}
            </div>)}
          </nav>
          <div className="mt-6 rounded-xl border border-white/15 p-3">
            <div className="flex items-center gap-2 text-xs text-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-300" /> État réseau à connecter</div>
            <p className="mt-2 text-xs text-emerald-100">Dernière synchronisation : —</p>
            <p className="mt-1 text-xs text-emerald-100">Dernière sauvegarde : —</p>
          </div>
          <p className="mt-4 px-1 text-xs text-emerald-100">© NAXA · Maquette d’interface</p>
        </aside>

        <div className="min-w-0 space-y-8">
          <header className="rounded-2xl bg-[#0f6b3f] p-4 text-white shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Espace caisse · aperçu UI</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Bonjour, Mme Ngo</h1><p className="mt-2 max-w-2xl text-sm text-emerald-50">Votre poste de travail, les repères du jour et les accès rapides réunis au même endroit.</p></div>
              <div className="flex items-center gap-3">
                <div className="hidden rounded-xl border border-white/20 px-3 py-2 text-sm sm:block">FR <span className="px-1 text-emerald-100">/</span> EN</div>
                <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-xl" aria-label="Cloche de notifications décorative">♧<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ffe23d] px-1 text-xs font-black text-[#0b3d26]">3</span></div>
                <div className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/60 bg-[#d7eadf] font-black text-[#0b3d26]" aria-label="Avatar illustratif">MN</div>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-emerald-100">Pharmacie</p><p className="mt-1 font-bold">Nom de la pharmacie</p></div>
              <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-emerald-100">Profil</p><p className="mt-1 font-bold">Caissière · accès visuel</p></div>
              <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-emerald-100">Réseau</p><p className="mt-1 font-bold">État illustratif · en ligne</p></div>
            </div>
          </header>

          <section>
            <SectionHeading number="01" title="Tableau de bord" description="Vue d’accueil de la caisse — cartes, courbe, alertes, raccourcis et poste de vente présentés sans logique métier." />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map((s) => <article key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-500">{s.label}</p><Mark tone={s.tone}>{s.icon}</Mark></div><p className="mt-4 text-2xl font-black tracking-tight text-slate-900">{s.value}</p><p className="mt-1 text-xs text-slate-500">{s.note}</p>
            </article>)}</div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Panel title="Activité de la journée" subtitle="Courbe horaire illustrative · aucun chiffre réel">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Ventes par heure</span><span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-800">Aujourd’hui</span></div>
                <MiniBars /><div className="mt-2 flex justify-between text-xs text-slate-400"><span>08 h</span><span>12 h</span><span>16 h</span><span>20 h</span></div>
              </Panel>
              <Panel title="À suivre" subtitle="Compteurs visuels, à alimenter plus tard">
                <PlaceholderRows rows={[
                  { title: "Ordonnances en attente", detail: "À traiter par le profil habilité", status: "—", tone: "blue" },
                  { title: "Réservations à préparer", detail: "Échéance la plus proche : —", status: "—", tone: "yellow" },
                  { title: "Paniers en attente", detail: "Reprise de panier", status: "—", tone: "purple" },
                  { title: "Mes demandes", detail: "En attente · validées · refusées", status: "—", tone: "green" },
                ]} />
              </Panel>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel title="Accès rapides" subtitle="Présentation des actions prévues par le cahier des charges">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {["Nouvelle vente", "Ordonnances", "Réservations", "Mon stock", "Mes demandes", "Clôturer ma caisse"].map((label, i) => <div key={label} className="flex min-h-24 flex-col items-start justify-between rounded-xl border border-slate-200 p-3"><Mark tone={["green", "blue", "yellow", "purple", "slate", "red"][i]}>{["＋", "▧", "◷", "▤", "✓", "⇥"][i]}</Mark><span className="mt-3 text-sm font-bold">{label}</span></div>)}
                </div>
              </Panel>
              <Panel title="Produits en alerte" subtitle="État vide et présentation de ligne">
                <PlaceholderRows rows={[
                  { title: "Produit à surveiller", detail: "Stock bas · quantité à connecter", status: "Stock bas", tone: "yellow" },
                  { title: "Produit proche péremption", detail: "Date à connecter", status: "Péremption", tone: "red" },
                  { title: "Produit sans prix", detail: "Demande de prix au promoteur", status: "Prix manquant", tone: "blue" },
                ]} />
                <div className="mt-4"><EmptyState title="État vide illustratif" description="Si aucune alerte n’est présente, ce bloc explique clairement qu’aucun produit ne nécessite d’action." /></div>
              </Panel>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-extrabold">Poste de caisse — aperçu visuel</h3><p className="mt-1 text-sm text-slate-500">Recherche, panier, paiement et clôture représentés sans action réelle.</p></div><StaticButton>＋ Nouvelle vente</StaticButton></div>
              <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <div className="flex gap-2"><div className="flex min-h-11 flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-400">⌕ Rechercher nom, molécule ou code-barres…</div><StaticButton kind="light">▣ Scanner</StaticButton></div>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 to-slate-100 text-2xl">▧</div><div className="min-w-0 flex-1"><p className="font-bold">Produit à ajouter au panier</p><p className="text-xs text-slate-500">Dosage · conditionnement</p><p className="mt-1 text-xs text-emerald-700">Stock · péremption · ordonnance : états visuels</p></div><span className="font-bold">— FCFA</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500"><span>Quantité × prix unitaire</span><span>Total ligne : —</span></div>
                  <div className="flex flex-wrap gap-2"><StaticButton kind="light">Mettre en attente</StaticButton><StaticButton kind="light">Remise</StaticButton><StaticButton kind="danger">Vider le panier</StaticButton></div>
                </div>
                <div className="rounded-xl bg-[#f4f8f5] p-4">
                  <p className="text-sm font-bold text-slate-600">Récapitulatif du panier</p><div className="mt-4 space-y-3 border-b border-slate-200 pb-4 text-sm"><div className="flex justify-between"><span>Sous-total</span><span>— FCFA</span></div><div className="flex justify-between"><span>Remise</span><span>— FCFA</span></div><div className="flex justify-between"><span>Assurance / crédit</span><span>—</span></div></div>
                  <div className="flex items-end justify-between py-4"><span className="font-bold">Total à payer</span><strong className="text-2xl">— FCFA</strong></div><div className="grid gap-2 sm:grid-cols-2"><StaticButton>Payer</StaticButton><StaticButton kind="light">Choisir le client</StaticButton></div>
                  <p className="mt-3 text-xs text-slate-500">Les méthodes de paiement, la validation et l’écriture comptable ne sont pas activées dans cette maquette.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeading number="02" title="Clients et Assurances" description="Répertoire, crédits, couvertures et dossiers de tiers payant : formes de recherche, compteurs, tableaux et états vides." />
            <div className="grid gap-3 sm:grid-cols-3">{[["Clients connus", "Répertoire"], ["Crédits à recouvrer", "Encours"], ["Dossiers assurance", "Tiers payant"]].map(([a,b]) => <div key={a} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{a}</p><p className="mt-2 text-2xl font-black">—</p><p className="text-xs text-slate-400">{b} · données à connecter</p></div>)}</div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <Panel title="Répertoire clients" subtitle="Recherche et filtres — maquette">
                <div className="mb-3 flex flex-wrap gap-2"><div className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-400">Nom, téléphone ou référence…</div><StaticButton kind="light">Filtres</StaticButton><StaticButton>＋ Nouveau client</StaticButton></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Référence</th><th className="p-3">Client</th><th className="p-3">Crédit</th><th className="p-3">État</th></tr></thead><tbody>{["CL-0001", "CL-0002", "CL-0003"].map((x) => <tr key={x} className="border-t border-slate-100"><td className="p-3 font-mono">{x}</td><td className="p-3">Nom masqué / exemple</td><td className="p-3">— FCFA</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">À connecter</span></td></tr>)}</tbody></table></div>
              </Panel>
              <Panel title="Assurances & tiers payant" subtitle="Couverture, adhérent, taux et suivi">
                <PlaceholderRows rows={[
                  { title: "Assureur / mutuelle", detail: "Nom et référence de couverture", status: "À vérifier", tone: "blue" },
                  { title: "Dossier de prise en charge", detail: "Montant total : — · part assureur : —", status: "En attente", tone: "yellow" },
                ]} />
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><p className="font-bold">Information de maquette</p><p className="mt-1">Aucune vérification externe d’assureur, décision de remboursement ou écriture financière n’est déclenchée.</p></div>
              </Panel>
            </div>
          </section>

          <section>
            <SectionHeading number="03" title="Historique des ventes" description="Recherche, filtres, lignes de tickets, détails, duplicata et demande d’annulation représentés visuellement." />
            <Panel title="Journal des tickets" subtitle="Tableau de présentation — aucune vente réelle chargée">
              <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_190px_auto]"><div className="min-h-11 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-400">Numéro de ticket, date ou mode…</div><div className="min-h-11 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-500">Tous les statuts ▾</div><StaticButton kind="light">Réinitialiser</StaticButton></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Ticket", "Date", "Mode de paiement", "Total", "Statut", "Actions"].map((x) => <th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{["NX-000123", "NX-000122", "NX-000121"].map((x, i) => <tr key={x} className="border-t border-slate-100"><td className="p-3 font-mono font-bold">{x}</td><td className="p-3">— / — / —</td><td className="p-3">Non renseigné</td><td className="p-3">— FCFA</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{["Payée", "Brouillon", "Annulée"][i]}</span></td><td className="p-3"><div className="flex gap-1"><StaticButton kind="light">Détail</StaticButton><StaticButton kind="light">Duplicata</StaticButton></div></td></tr>)}</tbody></table></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-dashed border-slate-300 p-4"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Duplicata de ticket</p><p className="mt-2 font-extrabold">NAXA · Ticket de caisse</p><div className="my-3 border-t border-dashed" /><div className="space-y-2 text-sm text-slate-500"><p>Produit · quantité · prix unitaire</p><p>Sous-total : — FCFA</p><p>Remise : — FCFA</p><p className="font-black text-slate-800">Total : — FCFA</p></div><div className="mt-3"><StaticButton kind="light">Imprimer le duplicata</StaticButton></div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-950">Demande d’annulation</p><p className="mt-1 text-sm text-amber-900">Motif obligatoire · demande en attente de décision d’un rôle habilité.</p><div className="mt-3"><StaticButton kind="light">Voir le statut</StaticButton></div></div></div>
            </Panel>
          </section>

          <section>
            <SectionHeading number="04" title="Prise / fin de service" description="Écran de prise de poste, fond initial, indicateur de session, rapprochement et écart de caisse." />
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Panel title="Prendre mon service" subtitle="État de session et fond initial">
                <div className="mb-4 flex items-center gap-3 rounded-xl bg-emerald-50 p-3"><Mark>◷</Mark><div><p className="font-bold text-emerald-900">Session de caisse</p><p className="text-sm text-emerald-800">Statut non connecté · affichage d’exemple</p></div></div>
                <label className="block text-sm font-bold text-slate-700">Fond initial (FCFA)<div className="mt-1 flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 font-normal text-slate-400">Montant à saisir — champ visuel</div></label>
                <div className="mt-3"><StaticButton>Prendre mon service</StaticButton></div>
                <p className="mt-3 text-xs text-slate-500">Bouton illustratif : aucune session n’est ouverte.</p>
              </Panel>
              <Panel title="Fin de service et rapprochement" subtitle="Récapitulatif visuel">
                <div className="space-y-3">{[["Fond initial", "— FCFA"], ["Espèces théoriques", "— FCFA"], ["Montant compté", "— FCFA"], ["Écart constaté", "— FCFA"]].map(([k,v]) => <div key={k} className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm last:border-0"><span className="text-slate-500">{k}</span><span className="font-extrabold">{v}</span></div>)}</div>
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-bold">Justification d’écart</p><p className="mt-1">Une justification doit être conservée si un écart est constaté.</p></div>
                <div className="mt-3 flex flex-wrap gap-2"><StaticButton>Clôturer ma caisse</StaticButton><StaticButton kind="light">Voir mes sessions</StaticButton></div>
              </Panel>
            </div>
            <Panel title="Mes sessions récentes" subtitle="Historique illustratif"><div className="mt-2"><PlaceholderRows rows={[{ title: "Service du matin", detail: "Ouverture — · clôture —", status: "À connecter" }, { title: "Service précédent", detail: "Fond — · écart —", status: "À connecter" }]} /></div></Panel>
          </section>

          <section>
            <SectionHeading number="05" title="Rapports & Performances" description="Indicateurs personnels uniquement, évolution horaire, ventes par produit et répartition des paiements — sans marge ni prix d’achat." />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Ventes payées", "—"], ["Montant encaissé", "— FCFA"], ["Tickets émis", "—"], ["Sessions consultables", "—"]].map(([a,b]) => <div key={a} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{a}</p><p className="mt-2 text-2xl font-black">{b}</p><p className="mt-1 text-xs text-slate-400">Valeur à connecter</p></div>)}</div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <Panel title="Évolution des ventes" subtitle="Courbe décorative — valeurs non chargées"><MiniBars /></Panel>
              <Panel title="Répartition des paiements" subtitle="Légende de présentation"><div className="space-y-4 pt-2">{[["Espèces", "bg-[#0f6b3f]", "—"], ["Mobile Money saisi", "bg-[#e5bf00]", "—"], ["Assurance / tiers payant", "bg-[#2563eb]", "—"], ["Crédit client", "bg-[#8b5cf6]", "—"]].map(([name, color, val]) => <div key={name}><div className="mb-1 flex justify-between text-sm"><span>{name}</span><span className="font-bold">{val}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={"h-2 w-1/3 rounded-full " + color} /></div></div>)}</div></Panel>
              <Panel title="Top produits" subtitle="Uniquement les produits vendus par ce compte"><PlaceholderRows rows={[{ title: "Produit le plus vendu", detail: "Quantité — · total — FCFA", status: "1" }, { title: "Produit suivant", detail: "Quantité — · total — FCFA", status: "2" }, { title: "Troisième produit", detail: "Quantité — · total — FCFA", status: "3" }]} /></Panel>
              <Panel title="Produits sans prix" subtitle="État d’alerte et action prévue"><EmptyState title="Aucune donnée connectée" description="La liste sera alimentée lorsque le module de données sera branché." /><div className="mt-3"><StaticButton kind="light">Demander un prix au promoteur</StaticButton></div></Panel>
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><StaticButton kind="light">Exporter PDF</StaticButton><StaticButton kind="light">Exporter Excel</StaticButton><StaticButton kind="light">Rapport de fin de journée</StaticButton></div>
          </section>

          <section>
            <SectionHeading number="06" title="Profil" description="Informations de compte, sécurité, préférences d’affichage et activité récente — formulaires et commandes visuels seulement." />
            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <Panel title="Carte de profil" subtitle="Avatar et identité à connecter">
                <div className="flex items-center gap-4"><div className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-[#d7eadf] to-[#ffe23d] text-2xl font-black text-[#0b3d26]">MN</div><div><p className="text-lg font-extrabold">Mme Ngo</p><p className="text-sm text-slate-500">Caissière</p><p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">Statut à connecter</p></div></div>
                <div className="mt-4 space-y-3">{[["Identifiant", "—"], ["Téléphone", "—"], ["Pharmacie", "—"], ["État du compte", "—"]].map(([a,b]) => <div key={a} className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-sm"><span className="text-slate-500">{a}</span><span className="font-semibold">{b}</span></div>)}</div>
              </Panel>
              <div className="space-y-4">
                <Panel title="Sécurité du compte" subtitle="Champs, messages et commandes visuels">
                  <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-sm font-bold">Nouveau mot de passe</p><div className="mt-1 min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-400">••••••••••••</div></div><div><p className="text-sm font-bold">Confirmer le mot de passe</p><div className="mt-1 min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-400">••••••••••••</div></div></div>
                  <div className="mt-3"><StaticButton>Mettre à jour le mot de passe</StaticButton></div>
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p className="font-bold">Exemple de message d’erreur</p><p className="mt-1">La modification n’a pas pu être confirmée. Réessayez plus tard.</p></div>
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-bold">Exemple de confirmation</p><p className="mt-1">Les modifications seront confirmées après connexion au service.</p></div>
                </Panel>
                <Panel title="Préférences d’affichage" subtitle="Exemples de commandes non actives">
                  <div className="flex flex-wrap gap-2"><StaticButton kind="light">Texte normal</StaticButton><StaticButton kind="light">Texte agrandi</StaticButton><StaticButton kind="light">Affichage compact</StaticButton><StaticButton kind="light">Mode léger</StaticButton></div>
                </Panel>
              </div>
            </div>
            <Panel title="Activité récente" subtitle="Aucun événement réel affiché dans la maquette"><PlaceholderRows rows={[{ title: "Ouverture de service", detail: "Date et heure : —", status: "Exemple" }, { title: "Clôture de service", detail: "Rapprochement : —", status: "Exemple" }]} /></Panel>
          </section>

          <section>
            <SectionHeading number="07" title="Déconnexion" description="État visuel de sortie, confirmation, état hors ligne et erreur — aucun appel d’authentification." />
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Quitter le poste" subtitle="Carte de déconnexion">
                <div className="flex items-start gap-3"><Mark tone="yellow">↪</Mark><div><p className="font-extrabold">Vous allez quitter votre espace caisse</p><p className="mt-1 text-sm text-slate-500">En situation réelle, vérifiez que la caisse est clôturée et que les données en attente sont synchronisées.</p></div></div>
                <div className="mt-4 flex flex-wrap gap-2"><StaticButton kind="danger">Se déconnecter</StaticButton><StaticButton kind="light">Annuler</StaticButton></div>
              </Panel>
              <Panel title="États de message" subtitle="Variantes à prévoir dans l’interface">
                <div className="space-y-2"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><b>En ligne</b><p className="mt-1">Connexion disponible.</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><b>Hors ligne</b><p className="mt-1">Reconnexion nécessaire avant de terminer la synchronisation.</p></div><div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>Erreur</b><p className="mt-1">Déconnexion impossible. Réessayez après vérification de la connexion.</p></div></div>
              </Panel>
            </div>
          </section>

          <section>
            <SectionHeading number="C0" title="Éléments communs et états" description="Vérification visuelle transversale du cahier des charges : chargement, vide, erreur, hors-ligne, accès refusé et mode léger." />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><Mark tone="slate">◌</Mark><p className="font-extrabold">Chargement</p></div><div className="mt-4 space-y-2"><div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" /><div className="h-3 w-full animate-pulse rounded bg-slate-100" /><div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" /></div><p className="mt-3 text-sm text-slate-500">Squelette de carte</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><Mark tone="blue">⌕</Mark><p className="font-extrabold">État vide</p></div><p className="mt-3 text-sm text-slate-500">Aucun élément à afficher pour le moment.</p><div className="mt-3"><StaticButton kind="light">Action proposée</StaticButton></div></div>
              <div className="rounded-2xl border border-red-200 bg-white p-4"><div className="flex items-center gap-2"><Mark tone="red">!</Mark><p className="font-extrabold">Erreur</p></div><p className="mt-3 text-sm text-red-800">Impossible de charger cette section. Réessayez.</p><div className="mt-3"><StaticButton kind="light">Réessayer</StaticButton></div></div>
              <div className="rounded-2xl border border-amber-200 bg-white p-4"><div className="flex items-center gap-2"><Mark tone="yellow">⌁</Mark><p className="font-extrabold">Hors ligne</p></div><p className="mt-3 text-sm text-slate-600">Certaines données peuvent être indisponibles. Éléments en attente : —</p></div>
              <div className="rounded-2xl border border-red-200 bg-white p-4"><div className="flex items-center gap-2"><Mark tone="red">⊘</Mark><p className="font-extrabold">Accès refusé</p></div><p className="mt-3 text-sm text-slate-600">Vous n’avez pas l’autorisation d’afficher cette page.</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><Mark tone="slate">◐</Mark><p className="font-extrabold">Mode léger</p></div><p className="mt-3 text-sm text-slate-600">Interface sobre, images réduites et données minimales pour les connexions lentes.</p></div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="font-extrabold">Contrôles visuels du cahier</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{["Cibles tactiles d’au moins 44 px", "Contraste lisible", "Mise en page mobile / tablette / ordinateur", "Logo et identité de pharmacie", "Langue FR / EN", "Notifications et compteur", "Réseau et synchronisation", "Dernière sauvegarde", "Messages simples", "Pas de marge ni prix d’achat côté caisse"].map((x) => <div key={x} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="grid h-5 w-5 place-items-center rounded border border-slate-300 bg-white text-xs text-slate-400">□</span>{x}</div>)}</div>
            </div>
          </section>
          <footer className="rounded-2xl bg-[#0b3d26] p-5 text-sm text-white"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffe23d] font-black text-[#0b3d26]">N</div><div><p className="font-black">NAXA · Espace caisse</p><p className="text-xs text-emerald-100">Prototype visuel non connecté</p></div></div><p className="text-xs text-emerald-100">Aucun paiement, écriture, notification ou changement de compte n’est exécuté.</p></div></footer>
        </div>
      </div>
    </div>
  </main>;
}
