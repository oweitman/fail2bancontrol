const API_BASE = '/api';

/**
 * Globalen Fail2ban Status abrufen
 * -> { jails: number, list: string[] }
 */
export async function getGlobalStatus() {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error(`Error: ${res.status} ${res.statusText}`);
    let data = await res.json();
    return data;
}

/**
 * Liste aller Jails abrufen
 * -> string[]
 */
export async function getJails() {
    const res = await fetch(`${API_BASE}/jails`);
    if (!res.ok) throw new Error(`Error: ${res.status}`);

    let data = await res.json();
    return data;
}

/**
 * Status für ein bestimmtes Jail abrufen
 * -> { filter: {...}, actions: {...} }
 */
export async function getJailStatus(jailName) {
    const res = await fetch(`${API_BASE}/jail/${encodeURIComponent(jailName)}/status`);
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    return res.json();
}

/**
 * IP in einem Jail bannen
 */
export async function banIP(jailName, ip) {
    const res = await fetch(`${API_BASE}/jail/${encodeURIComponent(jailName)}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    return res.json();
}

/**
 * IP in einem Jail entbannen
 */
export async function unbanIP(jailName, ip) {
    const res = await fetch(`${API_BASE}/jail/${encodeURIComponent(jailName)}/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    return res.json();
}
