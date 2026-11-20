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
| Carnet du véhicule | Fonction d'appel utile sans autres utilisateurs. Échéances **contrôle technique, assurance, entretien, autre** par véhicule, rappels à 30 jours, 7 jours et le jour même à 9 h (notifications locales). Bouton « Fait » proposant la date suivante (CT +2 ans, assurance +1 an, entretien +1 an). Calcul du CT à partir de la date de première mise en circulation (champ facultatif, date toujours corrigeable). Données **sur le téléphone seulement**. Onglet « Carnet ». Autorisation des notifications demandée à la première échéance |
| Garer ici | Dans l'onglet Carnet : enregistre la position (autorisation « pendant l'utilisation » seulement), un seul emplacement, sur le téléphone, itinéraire à pied vers l'emplacement |
| Plaque sans compte | Message d'aide (« ce conducteur n'est pas encore sur Plaq'Up ») avec bouton de partage du lien d'installation. Le QR sur pare-brise viendra après la v1 |
| Distribution | Premiers testeurs Android par lien APK, iPhone par TestFlight dès que le compte Apple est actif. Test fermé Google : viser 12 testeurs. Lancement dans la résidence et le quartier du propriétaire. Lien unique `/app` servi par le backend, qui sert aussi de page de présentation (liens légaux, contact) |
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
- Stockage Cloudflare R2 privé, accès réservé aux deux participants de la conversation.
- Les liens sont fabriqués par le serveur à chaque chargement de la conversation, valables 1 heure. L'app en redemande un frais si une image échoue. Les images ne transitent pas par Railway (le trafic sortant y est facturé).
- Plafonds contre les coûts abusifs (réglables dans un fichier de configuration) :
  - 2 Mo par image, JPEG, PNG ou WebP, type vérifié sur le contenu du fichier ;
  - 20 images envoyées par 24 h et par utilisateur ;
  - plafond global de stockage de 8 Go et plafond mensuel d'écritures, sous les limites gratuites. Au-delà, l'envoi d'images est refusé, le texte continue ;
  - 300 liens de lecture par heure et par utilisateur.
- Ménage : les images jamais rattachées à un message sont supprimées après 24 h ; celles d'une conversation ou d'un compte supprimé sont effacées du bucket.
- La page d'administration affiche le stockage utilisé et le nombre d'images.
- Alerte de facturation à activer côté Cloudflare.
- Fini quand : une image n'est plus lisible sans jeton valide, survit à un déploiement, et les plafonds refusent l'envoi avec un message clair.

### 4 bis. Carnet du véhicule, « Garer ici » et distribution
- Module Carnet dans l'app (échéances, rappels, calcul du CT), testé sans téléphone : stockage et notifications derrière deux adaptateurs (réels et de test).
- Onglet Carnet, saisie, bouton « Fait », « Garer ici ».
- Message d'aide quand une plaque n'a pas de compte, avec partage du lien.
- Page `/app` : présentation, installation (vers le bon magasin), liens légaux.
- Fini quand : tests du calcul des dates et des rappels, parcours ajouter / voir / marquer fait sur un téléphone, `/app` répond.

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
