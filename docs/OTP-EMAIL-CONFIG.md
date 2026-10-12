# NAXA — Configuration de l’OTP e-mail

Le code côté navigateur demande un code de confirmation à Supabase Auth. Le succès de `signUp` signifie que Supabase a accepté la demande, pas que le message a été livré dans la boîte de réception.

## Configuration nécessaire dans chaque projet Supabase

1. Dans **Authentication → Providers → Email**, activer la confirmation de l’adresse e-mail.
2. Dans **Authentication → Email Templates**, configurer le modèle de confirmation pour afficher le code OTP avec `{{ .Token }}` (et non uniquement un lien `{{ .ConfirmationURL }}`), puisque l’écran NAXA demande à l’utilisateur de saisir le code.
3. Configurer un fournisseur SMTP fonctionnel dans **Project Settings → Authentication/SMTP Settings** selon l’interface Supabase du projet. Vérifier le domaine expéditeur, les identifiants et les limites d’envoi.
4. Tester avec une adresse réelle, puis vérifier les journaux Auth et SMTP sans consigner le code OTP ni les secrets.
5. Vérifier la boîte de réception, les indésirables et les restrictions du fournisseur. Le bouton de renvoi NAXA est disponible après le délai de 40 secondes.

## Limites et sécurité

- Le délai de 40 secondes est un délai avant **renvoi**; il ne rend pas automatiquement invalide un code déjà reçu. La validité réelle du code est contrôlée par Supabase Auth.
- Si Supabase retourne une session dès l’inscription, la confirmation e-mail est probablement désactivée; NAXA affiche alors une erreur de configuration au lieu de prétendre qu’un OTP a été envoyé.
- Ne jamais désactiver la confirmation pour contourner un problème SMTP.
- La configuration de Production doit être vérifiée séparément et ne doit pas être modifiée dans le cadre de cette PR sans autorisation distincte.
