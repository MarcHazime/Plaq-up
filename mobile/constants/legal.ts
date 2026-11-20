// Served by the backend today; move to plaq-up.fr by changing this one origin.
const LEGAL_ORIGIN = 'https://plaqu-up-production.up.railway.app/legal';

// Presentation and install page: sends each phone to its store.
export const INSTALL_URL = 'https://plaqu-up-production.up.railway.app/app';

export const LEGAL_URLS = {
    privacy: `${LEGAL_ORIGIN}/privacy.html`,
    terms: `${LEGAL_ORIGIN}/terms.html`,
    deleteAccount: `${LEGAL_ORIGIN}/delete-account.html`,
};
