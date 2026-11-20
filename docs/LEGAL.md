# Légal : à faire avant la publication

Les pages sont dans `backend/public/legal/` et servies à `/legal/` (lien dans l'app via `mobile/constants/legal.ts`). Les textes sont des brouillons rédigés d'après le fonctionnement réel de l'app : à faire relire.

## À compléter (surlignés en jaune dans les pages)
- Identité de l'éditeur (nom, adresse, SIRET) : après création de la micro-entreprise. Pages `index.html`, `privacy.html`, `terms.html`.
- Médiateur de la consommation (`terms.html`).

## Choix à confirmer
- Âge minimum 15 ans (`privacy.html`). Les magasins demandent une classification d'âge : cohérente avec ce choix.
- Copies de signalements conservées après décision, sans durée fixée.
- Dès qu'un hébergeur ou prestataire change (ex. Sentry désactivé, publicité), mettre à jour la liste des destinataires.

## Quand les textes changent
Changer `TERMS_VERSION` dans `backend/src/account/terms.ts`. Chaque compte garde la date et la version acceptées. Redemander l'acceptation aux comptes existants n'est pas encore codé.

## Pour les magasins
Adresses à renseigner : politique de confidentialité = `/legal/privacy.html`, suppression de compte = `/legal/delete-account.html`. À terme, recopier les pages sur plaq-up.fr et changer `LEGAL_ORIGIN`.
