import { describe, expect, it } from 'vitest';
import { detectPlatform, linksFromEnv, renderInstallPage } from './install';

describe('install page', () => {
    it('detects the visitor platform', () => {
        expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android');
        expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
        expect(detectPlatform('Mozilla/5.0 (Macintosh)')).toBe('other');
        expect(detectPlatform(undefined)).toBe('other');
    });

    it('reads links from the environment, empty meaning not configured', () => {
        expect(linksFromEnv({ ANDROID_INSTALL_URL: 'https://play.google.com/x', IOS_INSTALL_URL: '' })).toEqual({
            android: 'https://play.google.com/x',
            ios: null,
        });
    });

    it('shows the visitor\'s store first and "soon" for what is not configured', () => {
        const html = renderInstallPage({ android: 'https://play.google.com/x', ios: null }, 'android');
        expect(html).toContain('href="https://play.google.com/x"');
        expect(html).toContain('Installer sur iPhone : bientôt disponible');
        expect(html.indexOf('Installer sur Android')).toBeLessThan(html.indexOf('Installer sur iPhone'));
        const ios = renderInstallPage({ android: 'https://a.example', ios: 'https://b.example' }, 'ios');
        expect(ios.indexOf('Installer sur iPhone')).toBeLessThan(ios.indexOf('Installer sur Android'));
    });

    it('never links to anything but https, and escapes the address', () => {
        const html = renderInstallPage({ android: 'javascript:alert(1)', ios: 'https://x.example/?a="b"' }, 'other');
        expect(html).not.toContain('javascript:');
        expect(html).toContain('&quot;b&quot;');
    });
});
