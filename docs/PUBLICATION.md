# Chantier 7 : publication iOS + Android

Légende : 👤 vous seul pouvez le faire · 🤖 je le fais dans le code · ⏱ délai à anticiper.

## A. À lancer tout de suite (ce sont les plus longs)

1. 👤 ⏱ **Micro-entreprise** (guichet unique de l'INPI, gratuit) : activité de services numériques. Compte professionnel bancaire séparé recommandé. Délai : quelques jours à 2 semaines.
2. 👤 ⏱ **Compte Apple Developer** (99 $/an) : inscription comme « individu » avec l'identité de la micro-entreprise. Délai : 1 à 3 jours, parfois plus. Le nom affiché sur l'App Store sera votre nom personnel (limite connue d'une micro-entreprise, voir PLAN-V1).
3. 👤 ⏱ **Compte Google Play Console** (25 $ une fois) : vérification d'identité obligatoire. Pour un compte *personnel* créé récemment, Google impose un **test fermé de 12 testeurs pendant 14 jours** avant la production. Un compte *organisation* (avec D-U-N-S) échappe à cette règle mais demande plus de papiers. À vérifier à l'écran au moment de l'inscription : règle susceptible d'évoluer.
4. 👤 **Railway : passer sur un plan payant** avant d'inviter des testeurs (le crédit d'essai s'épuise).
5. 👤 **Sentry** (compte + DSN) et **sauvegardes Railway** : voir docs/ADMIN.md.
6. 👤 **Alerte de facturation Cloudflare**, et vous déclarer administrateur (docs/ADMIN.md).

## B. Avant le premier build de production

7. ✅ **Identifiant d'application : `fr.plaqup.app`** (Android et iOS), choisi et appliqué dans `mobile/app.json`. Reste à faire 👤 :
   - **Firebase** (console.firebase.google.com, projet `plaq-up`) : *Paramètres du projet → Vos applications → Ajouter une application Android* avec le nom de package `fr.plaqup.app`, puis télécharger le nouveau `google-services.json` et le placer dans `mobile/` à la place de l'ancien. Sans ça, **les builds Android échouent**.
   - **iOS** : clé APNs pour les notifications, créée par EAS lors du premier build iOS (`npx eas-cli credentials`, il demande votre compte Apple Developer).
   - Les testeurs actuels devront désinstaller l'ancienne appli : l'ancienne et la nouvelle sont deux applis distinctes.
8. 🤖 **Nettoyage de la configuration** : ✅ permission `RECORD_AUDIO` retirée, `usesCleartextTraffic` à `false`, textes d'autorisation caméra et photothèque en français. Reste à vérifier : icône et écran de lancement définitifs (icône 1024×1024 sans transparence pour Apple), nom technique `vigiplaque` (invisible des utilisateurs). Note : un build « development » ne peut plus parler à un serveur local en HTTP.
9. 🤖 **Builds de production** : `eas build --profile production` pour les deux plateformes, puis `eas submit`. Je prépare `eas.json`. 👤 Il faudra vous connecter à vos comptes Apple et Google lors du premier envoi.
10. 🤖 **Compte de démonstration pour la revue** : un compte vérifié avec une plaque fictive et une conversation exemple, pour qu'Apple et Google puissent tester sans inscription. 👤 Vous gardez son mot de passe pour les formulaires.
11. 🤖 Variables de production : `SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN`, `SMTP_FROM` (déjà fait), retrait de `PRISMA_PUSH_FLAGS` (déjà fait).

## C. Contenu des fiches (👤 je rédige les textes avec vous)

Communs aux deux magasins :
- Nom : Plaq'Up. Sous-titre / description courte (80 car.) et description longue.
- Catégorie : Utilitaires ou Réseaux sociaux ; classification d'âge (15+ cohérent avec la politique de confidentialité).
- **Captures d'écran** : iPhone 6,9" (obligatoire) et 6,5", iPad si `supportsTablet` reste actif (sinon le désactiver) ; téléphone Android (2 minimum) et, pour Google, une illustration de 1024×500.
- Adresse de support : contact@plaq-up.fr ; page de politique de confidentialité : `/legal/privacy.html` ; page de suppression de compte : `/legal/delete-account.html`.
- Contenu généré par les utilisateurs : indiquer le signalement, le blocage et la modération (exigence Apple, règle 1.2).

Apple (App Store Connect) :
- Étiquettes de confidentialité (« App Privacy ») : email, identifiant utilisateur, contenu utilisateur (messages, images), identifiant d'appareil (notifications), données de diagnostic (Sentry). Aucun suivi publicitaire pour l'instant.
- Informations de revue : compte de démonstration, notes expliquant le principe (messagerie par plaque).
- Justification de l'usage de la caméra (scan de plaque).
- Chiffrement : déjà déclaré sans chiffrement exempt (`ITSAppUsesNonExemptEncryption: false`).

Google (Play Console) :
- Formulaire « Sécurité des données » (mêmes catégories) ; déclaration de suppression de compte avec l'adresse web de suppression ; déclaration du public cible ; questionnaire de classification ; déclaration de l'identifiant publicitaire (aucun).
- Test fermé de 12 testeurs / 14 jours si compte personnel (point 3).

## D. Vérifications avant l'envoi (🤖 + 👤)

- Parcours complet sur téléphone avec le build de production : inscription avec CGU, code reçu par email, connexion, ajout de véhicule, scan de plaque, message texte, image (vérifier qu'elle arrive dans R2), signalement, blocage, suppression de compte.
- Un compte administrateur voit le signalement dans la page `/admin/`.
- Les trois liens légaux s'ouvrent depuis l'app et sont compris.
- Les champs jaunes des pages légales sont remplis (docs/LEGAL.md).
- Sentry reçoit une erreur de test (backend et app).
- Une sauvegarde de la base a été restaurée une fois sur une base jetable.

## E. Ordre conseillé

1. Maintenant : points 1, 2, 3, 4 (délais) en parallèle de mon travail.
2. Moi : points 7 (après votre choix de l'identifiant), 8, 9 (préparation), 10, 11.
3. Vous : captures d'écran, validation des textes des fiches.
4. Premier build de production → test interne (TestFlight, test interne Google) → vérifications D → envoi en revue.
5. Revue : Apple prend en général 1 à 2 jours, Google de 1 à plusieurs jours. Prévoir un aller-retour de correction.
