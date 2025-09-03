const API_BASE = '/api';

/**
* Get global fail2ban status
* -> { jails: number, list: string[] }
*/
export async function getGlobalStatus() {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error(`Error: ${res.status} ${res.statusText}`);
    let data = await res.json();
    return data;
}

/**
* Get a list of all jails
* -> string[]
*/
export async function getJails() {
    const res = await fetch(`${API_BASE}/jails`);
    if (!res.ok) throw new Error(`Error: ${res.status}`);

    let data = await res.json();
    return data;
}

/**
* Retrieve status for a specific jail
* -> { filter: {...}, actions: {...} }
*/
export async function getJailStatus(jailName) {
    const res = await fetch(`${API_BASE}/jail/${encodeURIComponent(jailName)}/status`);
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    return res.json();
}

/**
* Jail an IP address
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
* Unban IP in a jail
*/
export async function unbanIP(jailName, ip) {
    if (!jailName) {
        const res = await fetch(`${API_BASE}/unban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip }),   // { "ip": "123.123.123.123" }
        });

        if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(`Unban failed (${res.status}): ${msg}`);
        }
        return res.json(); // -> { result: "...", command: ["unban", "123.123.123.123"] }
    } else {
        const res = await fetch(`${API_BASE}/jail/${encodeURIComponent(jailName)}/unban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip }),
        });
        if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(`Unban failed (${res.status}): ${msg}`);
        }
        return res.json();
    }
}

export async function unbanAll() {
    const res = await fetch(`${API_BASE}/unban/all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ""
    });

    if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Unban failed (${res.status}): ${msg}`);
    }
    return res.json(); // -> { result: "...", command: ["unban", "123.123.123.123"] }
}
/**
* Retrieve the contents of a file
* @param {string} filePath - Absolute path to the file
* @param {number} lines - Number of lines: >0 = first N, <0 = last N, 0 = entire file
* -> { path: string, exists: boolean, lines: string[] }
*/
export async function getFile(filePath, lines = 0) {
    const url = `${API_BASE}/file?path=${encodeURIComponent(filePath)}&lines=${lines}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    return res.json();
}