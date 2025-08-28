// src/utils/version.js
const OWNER = 'oweitman';
const REPO = 'fail2bancontrol';

const LS_KEY = 'f2b.latestVersion.cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function readCache() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const { v, t } = JSON.parse(raw);
        if (!v || !t) return null;
        if (Date.now() - t > CACHE_TTL_MS) return null;
        return v;
    } catch {
        return null;
    }
}

function writeCache(v) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify({ v, t: Date.now() }));
    } catch {
        console.error('Failed to write version cache');
    }
}

/** very small semver compare (x.y.z only, ignores pre-release/build) */
export function cmpSemver(a, b) {
    const na = String(a).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const nb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        const da = na[i] ?? 0, db = nb[i] ?? 0;
        if (da > db) return 1;
        if (da < db) return -1;
    }
    return 0;
}

/** Fetch latest version from GitHub Release API */
async function fetchLatestFromGitHub() {
    try {
        const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
            headers: { 'Accept': 'application/vnd.github+json' },
        });
        if (r.ok) {
            const j = await r.json();
            // prefer tag_name; often "vX.Y.Z"
            if (j && j.tag_name) return j.tag_name;
            if (j && j.name) return j.name;
        }
    } catch (e) {
        console.error('Failed to fetch latest release from GitHub', e);
    }
    return null;
}

/** Public API: get latest version (with localStorage cache) */
export async function getLatestVersion() {
    const cached = readCache();
    if (cached) return cached;

    const v = await fetchLatestFromGitHub();
    if (v) writeCache(v);
    return v;
}
