import type { Request, Response } from 'express';

export interface InstallLinks {
    /** Play Store listing, or a direct link to the test build while the app is not published. */
    android: string | null;
    /** App Store listing, or TestFlight invitation. */
    ios: string | null;
}

export type Platform = 'android' | 'ios' | 'other';

export function linksFromEnv(env: NodeJS.ProcessEnv = process.env): InstallLinks {
    return { android: env.ANDROID_INSTALL_URL || null, ios: env.IOS_INSTALL_URL || null };
}

export function detectPlatform(userAgent: string | undefined): Platform {
    const ua = userAgent ?? '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'other';
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The presentation and install page. Only links we configured are shown, and the visitor's own store comes first. */
export function renderInstallPage(links: InstallLinks, platform: Platform): string {
    const button = (label: string, href: string | null, soon: string) =>
        href && /^https:\/\//.test(href)
            ? `<a class="btn" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
            : `<span class="btn off">${escapeHtml(label)} : ${escapeHtml(soon)}</span>`;

    const android = button('Installer sur Android', links.android, 'bientôt disponible');
    const ios = button('Installer sur iPhone', links.ios, 'bientôt disponible');
    const buttons = platform === 'ios' ? [ios, android] : [android, ios];

    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plaq'Up</title><link rel="stylesheet" href="/legal/legal.css"><link rel="stylesheet" href="/legal/install.css"></head><body>
<h1>Plaq'Up</h1>
<p class="lead">Un message pour le conducteur d'un véhicule, à partir de sa plaque.</p>
<ul>
<li>Un feu éteint, une portière mal fermée, un stationnement gênant : prévenez le propriétaire sans connaître son numéro.</li>
<li>Anonyme : votre email n'est jamais montré, seulement votre plaque ou un pseudo.</li>
<li>Un carnet pour ne plus oublier le contrôle technique, l'assurance et l'entretien, et un rappel de l'endroit où vous avez garé votre voiture.</li>
</ul>
<p class="buttons">${buttons.join('')}</p>
<hr>
<p><a href="/legal/privacy.html">Confidentialité</a> · <a href="/legal/terms.html">Conditions d'utilisation</a> · <a href="/legal/delete-account.html">Supprimer mon compte</a> · <a href="mailto:contact@plaq-up.fr">contact@plaq-up.fr</a></p>
</body></html>`;
}

export function installPage(req: Request, res: Response) {
    res.type('html').send(renderInstallPage(linksFromEnv(), detectPlatform(req.get('user-agent'))));
}
