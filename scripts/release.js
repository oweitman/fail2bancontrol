#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const PKG_PATH = path.join(process.cwd(), 'package.json');
const README_PATH = path.join(process.cwd(), '../README.md');
const CHANGELOG_MARKER = '<!-- CHANGELOG:INSERT -->'; // <<< anpassen, falls nötig
const DO_TAG = process.env.NO_TAG ? false : true; // setze NO_TAG=1 um Tagging zu überspringen

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function bumpSemver(v, kind) {
    // sehr simple SemVer (x.y.z), ignoriert pre-release/build
    const [maj, min, pat] = String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    if (kind === 'major') return `${maj + 1}.0.0`;
    if (kind === 'minor') return `${maj}.${min + 1}.0`;
    return `${maj}.${min}.${(pat || 0) + 1}`;
}
function formatDateISO(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function updateReadme(version) {
    if (!fs.existsSync(README_PATH)) {
        console.warn('README.md nicht gefunden – überspringe Changelog-Update.');
        return;
    }
    const raw = fs.readFileSync(README_PATH, 'utf8');
    const line = `### v${version} – ${formatDateISO()}`;
    if (raw.includes(CHANGELOG_MARKER)) {
        const updated = raw.replace(CHANGELOG_MARKER, `${CHANGELOG_MARKER}\n${line}`);
        fs.writeFileSync(README_PATH, updated, 'utf8');
        console.log(`README.md: Eintrag unter Marker eingefügt.`);
    } else {
        // Fallback: an den Anfang anhängen
        const updated = `## Changelog\n\n${line}\n` + raw;
        fs.writeFileSync(README_PATH, updated, 'utf8');
        console.log(`README.md: Marker nicht gefunden – Changelog-Block vorn ergänzt.`);
    }
}

function sh(cmd) {
    return execSync(cmd, { stdio: 'inherit' });
}

/** Prüft, ob ungestagte oder gestagte (aber nicht committete) Änderungen vorliegen. */
function assertNoUnstagedChanges() {
    try {
        // Exit-Code != 0, wenn ungestagte Änderungen existieren
        execSync('git diff --quiet', { stdio: 'ignore' });
    } catch {
        console.error(
            '\n❌ Abbruch: Es liegen ungestagte Änderungen vor.\n' +
            'Bitte zuerst committen oder stashen (z. B. `git add -A && git commit -m "WIP"` oder `git stash`).\n'
        );
        process.exit(1);
    }

    try {
        // Exit-Code != 0, wenn gestagte Änderungen existieren, die noch nicht committet wurden
        execSync('git diff --cached --quiet', { stdio: 'ignore' });
    } catch {
        console.error(
            '\n❌ Abbruch: Es liegen gestagte, aber noch nicht committete Änderungen vor.\n' +
            'Bitte zuerst committen oder resetten.\n'
        );
        process.exit(1);
    }
}

async function askBump(current) {
    console.log(`Aktuelle Version in package.json: ${current}`);
    console.log('Was möchtest du erhöhen? [m]ajor / [i]minor / [p]patch');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(res => rl.question('Auswahl (m/i/p): ', res));
    rl.close();
    const a = (answer || '').trim().toLowerCase();
    if (a === 'm' || a === 'major') return 'major';
    if (a === 'i' || a === 'minor') return 'minor';
    return 'patch';
}

(async function main() {
    // 0) Vorab: ungestagte Änderungen verbieten
    assertNoUnstagedChanges();

    // 1) Version lesen
    if (!fs.existsSync(PKG_PATH)) {
        console.error(`package.json nicht gefunden unter: ${PKG_PATH}`);
        process.exit(1);
    }
    const pkg = readJson(PKG_PATH);
    const cur = pkg.version || '0.0.0';

    // 2) Auswahl fragen
    const kind = await askBump(cur);
    const next = bumpSemver(cur, kind);

    // 3) Version schreiben
    pkg.version = next;
    writeJson(PKG_PATH, pkg);
    console.log(`Version gebumpt: ${cur} -> ${next}`);

    // 4) README Changelog aktualisieren (Platzhalter)
    updateReadme(next);

    // 5) Commit & Push
    try {
        sh(`git add "${PKG_PATH}" "${README_PATH}"`);
    } catch {
        // README evtl. nicht vorhanden
        sh(`git add "${PKG_PATH}"`);
    }
    sh(`git commit -m "chore(release): v${next}"`);
    sh(`git push`);

    // 6) Optional: Tag erstellen & pushen (lokal, NICHT in Action)
    if (DO_TAG) {
        const tag = `v${next}`;
        try {
            sh(`git tag ${tag}`);
            sh(`git push origin ${tag}`);
            console.log(`Tag ${tag} erstellt & gepusht.`);
        } catch (e) {
            console.warn(`Konnte Tag ${tag} nicht erstellen/pushen. Du kannst das manuell tun:`);
            console.warn(`  git tag ${tag} && git push origin ${tag}`);
        }
    } else {
        console.log('NO_TAG aktiv – Tagging übersprungen.');
    }

    console.log('\n✅ Fertig. Der Release-Workflow sollte jetzt laufen (durch package.json-Änderung und/oder vorhandenen Tag).');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
