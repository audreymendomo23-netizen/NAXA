# Dictionnaire des données

Recherche (KPI canonique) → `evenements` type `recherche` → N1/N2 → dashboard/rapport.
Recherche historique « Les plus recherchés » → `recherche_events` → compatibilité/bandeau uniquement, hors KPI.
Fiche vue → evenements → entonnoir.
Réservation → reservations → N1/N2/N3 → dashboard/export.
CA → `v_reservations_ca` (`payee` ou `retiree`), grain réservation → N1/N2.
Stock → stocks → N2/N3.
Prix achat courant interne → stocks_couts (pharmacie × produit) → Promoteur/NAXA. `stocks.prix` reste le prix public/vente. `stocks_couts` ne suffit pas à calculer une marge historique : aucun KPI de marge transactionnelle n'est autorisé tant qu'un coût au moment de la vente n'est pas figé au grain de la transaction.
Lot/péremption → stocks_lots → Caisse/Promoteur/NAXA.
Alertes → alertes → N1/N2.
Snapshot → rapports → dashboard/e-mail.

## Convention monétaire
Code technique : **XAF**. Affichage utilisateur : **FCFA**. Aucun changement de valeur ou conversion n'est effectué.


Rapport — scope canonique : `scope_type` (`PHARMACIE|RESPONSABLE|PROMOTEUR|NAXA`), `scope_profile_id`, `scope_pharmacie_id`. Les champs historiques `portee`/`pharmacie_id` sont conservés pour compatibilité. Le scope ne constitue pas à lui seul une autorisation.


Export — projection du rapport autorisé ; aucun nouveau grain métier ni nouvelle autorisation. Le scope provient du rapport source et n'est pas recalculé dans le fichier exporté.
