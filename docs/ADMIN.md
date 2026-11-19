# Administration

La page d'administration est servie par le backend : `https://plaqu-up-production.up.railway.app/admin/`

Elle se connecte avec une plaque et un mot de passe de compte, comme l'app. Seuls les comptes marqués administrateur y accèdent : les autres reçoivent « Accès réservé aux administrateurs ».

## Se déclarer administrateur

Dans l'onglet Data/Query de Postgres sur Railway (remplacez l'email par celui de votre compte, déjà vérifié) :

```sql
UPDATE "User" SET "isAdmin" = true WHERE email = 'votre-email@exemple.fr';
```

Il n'existe volontairement aucune route pour devenir administrateur depuis l'app ou l'API.

## Ce que la page permet

- Chiffres : utilisateurs, comptes vérifiés, messages (total, 24 h, 7 jours), conversations, images stockées et leur poids, signalements à traiter, comptes suspendus.
- Signalements : le message signalé, les dix messages précédents de la conversation, les deux plaques et le motif. Classer sans suite, ou suspendre le compte signalé (ses autres signalements ouverts sont alors clos).
- Utilisateurs : recherche par plaque, suspension et déblocage. Un administrateur ne peut pas être suspendu.
- Un signalement qui porte sur une image propose un lien pour la voir (valable 1 heure), tant que l'image existe encore.

Un compte suspendu ne peut plus se connecter, son jeton existant est refusé (403 `ACCOUNT_SUSPENDED`) et il ne peut plus envoyer de message.

Les signalements gardent une copie figée du message : ils restent traitables même si le message ou un des comptes est supprimé ensuite.

## Images (Cloudflare R2)

Variables du service backend sur Railway : `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (et `R2_REGION`, `auto` par défaut). Sans aucune de ces variables, l'envoi d'images est désactivé. Une configuration partielle empêche le serveur de démarrer.

Plafonds (fichier `backend/src/images/images.ts`) : 2 Mo par image, 20 envois par 24 h et par utilisateur, 8 Go au total, 500 000 envois par mois, 300 liens de lecture par heure et par utilisateur. Au-delà, l'envoi d'images est refusé, le texte continue de fonctionner.

Une image jamais envoyée dans un message est supprimée du bucket après 24 h, ainsi que celles d'un compte supprimé.

## Quand un déploiement plante sur « There might be data loss »

Au démarrage, le serveur applique le schéma avec `prisma db push`. Si Prisma estime qu'un changement peut perdre des données (par exemple une contrainte d'unicité ajoutée), il refuse et le déploiement plante. Lisez l'avertissement : s'il porte sur une colonne neuve, sans doublon possible, il est sans danger.

Pour l'accepter une seule fois : ajoutez dans les variables du service backend `PRISMA_PUSH_FLAGS` = `--accept-data-loss`, laissez Railway redéployer, puis **supprimez la variable**. Elle n'est volontairement pas permanente, pour qu'une vraie suppression de colonne ne passe jamais sans que vous le décidiez.
