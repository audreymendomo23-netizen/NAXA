# Architecture NAXA — Vente, Pilotage et BI

Client → recherche → fiche → panier → réservation → pharmacie → retrait/paiement → indicateurs.

N1 NAXA → pilotage réseau → BI → rapports.
N2 Promoteur → pilotage pharmacie → équipe et performance.
N3 Caisse → commandes, stock, alertes.

Les données restent vivantes via Supabase et rafraîchissement/Realtimе sur les flux opérationnels.
