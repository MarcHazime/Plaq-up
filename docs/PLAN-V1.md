# Plan de la version 1 (publication iOS + Android)

Vocabulaire : voir [GLOSSARY.md](../GLOSSARY.md). Ce document décrit des décisions et des chantiers, pas le code.

## Décisions prises

| Sujet | Décision |
|---|---|
| Usage | Échanges libres entre utilisateurs, anonymat possible |
| Anonymat | L'email n'est jamais montré. L'autre voit la plaque, ou le **pseudo** s'il est défini (non unique) |
| Modération | Signalement d'un message, copie figée avec contexte, décision tracée, **suspension** (bloque connexion et envoi) |
| Administrateur | Une seule personne (le propriétaire). Page web minimale servie par le backend : nombre d'utilisateurs, nombre de messages, signalements, suspendre / débloquer |
| Suivi des erreurs | Sentry (backend + app). La page administrateur ne les affiche pas |
| RGPD | Suppression de compte dans l'app, politique de confidentialité, CGU acceptées à l'inscription. Durée de conservation des messages : plus tard |
| Suppression de compte | Tous les messages, envoyés et reçus, sont supprimés des deux côtés. Les signalements ouverts gardent leur copie figée jusqu'à décision |
| Compte non vérifié | La connexion renvoie vers l'écran de code. Aucun compte n'est créé si l'email n'est pas parti |
| Plafond quotidien | Nombre limité de premiers messages par jour à des inconnus. Réglage de profil « n'accepter que les conversations déjà ouvertes » |
| Quota gratuit | 20 conversations. Toutes comptent (même ouvertes par l'autre). Supprimer ne rend pas l'emplacement. La limite bloque seulement l'ouverture de nouvelles conversations, jamais la lecture ni la réponse. Avertissement à 16 puis à 20 |
| Images | Privées (lisibles seulement par les deux participants), liens temporaires, stockage externe gratuit (Cloudflare R2) |
| Plateformes | iOS et Android en même temps |
| Abonnement | 2,99 €/mois sans engagement, **après** la v1 (v1.1). La v1 compte les conversations mais ne bloque pas |
| Paiements | RevenueCat, mis en place seulement au moment de l'abonnement |
| Publicité ciblée | Plus tard, avec consentement RGPD explicite. Ne rien promettre qui l'interdise dans la politique de confidentialité |
| Statut | Micro-entreprise avant la publication. Note : sur Apple, une micro-entreprise s'affiche au nom de la personne. Une société (D-U-N-S) serait nécessaire pour afficher « Plaq'Up » |

## Chantiers, dans l'ordre

### 1. Module Chat (phase 4 du plan d'architecture)
- Un seul module pour envoyer, lire l'historique, marquer comme lu, supprimer pour soi.
- Une seule règle « peut-on écrire à cette personne ? » : blocage, suspension, plafond quotidien, quota.
- Trace durable de chaque conversation ouverte (elle survit à la suppression de la conversation), pour compter le quota.
- Un client de base de données partagé. Les notifications push et l'émission socket sont injectées.
- Fini quand : tests sur la règle d'accès et le quota, et plus d'accès direct à la base dans les contrôleurs de chat.

### 2. Module Compte (phase 5)
- Un port d'envoi d'email avec adaptateur Brevo et adaptateur console.
- Inscription sans compte orphelin, renvoi de code (déjà fait), connexion d'un compte non vérifié vers l'écran de code.
- Suppression de compte, pseudo, email jamais exposé par l'API (aujourd'hui `email` est renvoyé dans les conversations).
- Une seule règle de mot de passe, suppression du code mort SMTP.
- Fini quand : tests du parcours inscription, vérification, suppression.

### 3. Modération et page administrateur
- Table de signalements avec copie figée et contexte, décision, état de suspension sur l'utilisateur.
- Bouton « Signaler » dans le chat.
- Page administrateur protégée par un champ administrateur et le jeton existant.
- Fini quand : un signalement apparaît dans la page, et suspendre un compte l'empêche de se connecter et d'écrire.

### 4. Images privées
- Stockage Cloudflare R2 privé, liens temporaires, accès réservé aux deux participants.
- Fini quand : une image n'est plus lisible sans jeton valide et survit à un déploiement.

### 5. Suivi et sauvegardes
- Sentry dans le backend et dans l'app.
- Sauvegardes de la base Postgres sur Railway.

### 6. Légal
- CGU acceptées à l'inscription, politique de confidentialité, lien de suppression de compte.
- Petite page statique sur plaq-up.fr (adresses exigées par les deux magasins), contact `contact@plaq-up.fr`.

### 7. Publication
- Micro-entreprise, comptes Apple et Google, builds de production, captures et fiches, compte de démonstration pour la revue.
- Les informations bancaires et fiscales des magasins ne sont nécessaires qu'à l'abonnement.

## Après la v1 (v1.1)
- RevenueCat, abonnement 2,99 €/mois, blocage à 20 conversations, lecture du statut côté serveur par webhook.

## Plus tard
- Publicités ciblées (contrôles techniques, réductions), après consentement RGPD.

## Mobile
Le refactor mobile (phase 6 : client de requêtes commun, hooks de session et de chat) avance avec chaque écran touché : pseudo, signalement, avertissement de quota.
