# Dictionnaire des données

Recherche → evenements → N1/N2 → dashboard/rapport.
Fiche vue → evenements → entonnoir.
Réservation → reservations → N1/N2/N3 → dashboard/export.
CA → reservations.total pour retiree/payee → N1/N2.
Stock → stocks → N2/N3.
Prix achat courant interne → stocks_couts (pharmacie × produit) → Promoteur/NAXA. `stocks.prix` reste le prix public/vente. `stocks_couts` ne suffit pas à calculer une marge historique : aucun KPI de marge transactionnelle n'est autorisé tant qu'un coût au moment de la vente n'est pas figé au grain de la transaction.
Lot/péremption → stocks_lots → Caisse/Promoteur/NAXA.
Alertes → alertes → N1/N2.
Snapshot → rapports → dashboard/e-mail.
