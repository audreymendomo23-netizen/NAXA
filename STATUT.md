[object Object]

## Dixième chantier — ERP-007 Ordonnancier / registre sécurisé
- Audit : aucun ordonnancier ni registre de substances contrôlées trouvé dans `main` ; le modèle `prescriptions` existant est conservé comme socle.
- Construction additive : ordonnancier lié à `prescriptions` et `ventes`, plus registre interne dédié.
- Sécurité : RLS pharmacie + rôle/fonction autorisés ; aucune écriture directe ; inscription via RPC sécurisée.
- Contrôles : validation de l'ordonnance, expiration, rattachement vente/ordonnance/pharmacie et vente payée.
- Référence du registre obligatoire lorsqu'une dispensation est explicitement signalée comme substance contrôlée.
- Aucun changement Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**
