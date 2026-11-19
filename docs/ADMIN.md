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

- Chiffres : utilisateurs, comptes vérifiés, messages (total, 24 h, 7 jours), conversations, signalements à traiter, comptes suspendus.
- Signalements : le message signalé, les dix messages précédents de la conversation, les deux plaques et le motif. Classer sans suite, ou suspendre le compte signalé (ses autres signalements ouverts sont alors clos).
- Utilisateurs : recherche par plaque, suspension et déblocage. Un administrateur ne peut pas être suspendu.

Un compte suspendu ne peut plus se connecter, son jeton existant est refusé (403 `ACCOUNT_SUSPENDED`) et il ne peut plus envoyer de message.

Les signalements gardent une copie figée du message : ils restent traitables même si le message ou un des comptes est supprimé ensuite.
