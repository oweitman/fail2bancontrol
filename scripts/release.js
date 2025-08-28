#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const REPO_ROOT = path.join(process.cwd(), '..');          // script lives in src-frontend/
const FRONTEND_DIR = process.cwd();                        // = src-frontend
const BUILD_DIR_NAME = process.env.BUILD_DIR || 'dist';
const BUILD_DIR = path.join(FRONTEND_DIR, BUILD_DIR_NAME);

const PKG_PATH = path.join(FRONTEND_DIR, 'package.json'); // src-frontend/package.json
const README_PATH = path.join(REPO_ROOT, 'README.md');    // ../README.md
const CHANGELOG_MARKER = '<!-- CHANGELOG:INSERT -->';
const DO_TAG = process.env.NO_TAG ? false : true;         // set NO_TAG=1 to skip tagging

// clean env (removes e.g. VS Code Auto-Attach NODE_OPTIONS)
const CLEAN_ENV = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k !== 'NODE_OPTIONS')
);

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function bumpSemver(v, kind) {
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
        console.warn('README.md not found — skipping changelog update.');
        return;
    }
    const raw = fs.readFileSync(README_PATH, 'utf8');
    const line = `### v${version} — ${formatDateISO()}`;
    if (raw.includes(CHANGELOG_MARKER)) {
        const updated = raw.replace(CHANGELOG_MARKER, `${CHANGELOG_MARKER}\n${line}`);
        fs.writeFileSync(README_PATH, updated, 'utf8');
        console.log('README.md: Inserted entry below marker.');
    } else {
        const updated = `## Changelog\n\n${line}\n` + raw;
        fs.writeFileSync(README_PATH, updated, 'utf8');
        console.log('README.md: Marker not found — prepended a changelog block.');
    }
}

function sh(cmd, opts = {}) {
    return execSync(cmd, { stdio: 'inherit', env: CLEAN_ENV, ...opts });
}

/** Ensures there are no unstaged or staged-but-uncommitted changes. */
function assertNoUnstagedChanges() {
    try {
        // Working Tree vs Index
        execSync('git diff --quiet', { stdio: 'ignore' });
    } catch {
        console.error(
            '\n❌ Aborting: There are unstaged changes.\n' +
            'Please commit or stash first (e.g., `git add -A && git commit -m "WIP"` or `git stash`).\n'
        );
        process.exit(1);
    }
    try {
        // Index vs HEAD
        execSync('git diff --cached --quiet', { stdio: 'ignore' });
    } catch {
        console.error(
            '\n❌ Aborting: There are staged but uncommitted changes.\n' +
            'Please commit or reset them first.\n'
        );
        process.exit(1);
    }
}

/** Aborts if the path is ignored by .gitignore */
function assertNotIgnoredInGit(p) {
    try {
        // exit 0 => ignored, exit 1 => not ignored (we treat 1 as "ok" via the catch)
        execSync(`git check-ignore -q -- "${p}"`, { stdio: 'ignore' });
        console.error(`\n❌ Aborting: "${p}" is ignored by .gitignore. Please adjust it or the build cannot be committed.\n`);
        process.exit(1);
    } catch {
        // not ignored -> ok
    }
}

async function askBump(current) {
    console.log(`Current version in src-frontend/package.json: ${current}`);
    console.log('What do you want to bump? [m]ajor / [i]minor / [p]atch');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(res => rl.question('Choice (m/i/p): ', res));
    rl.close();
    const a = (answer || '').trim().toLowerCase();
    if (a === 'm' || a === 'major') return 'major';
    if (a === 'i' || a === 'minor') return 'minor';
    return 'patch';
}

(function ensurePaths() {
    if (!fs.existsSync(PKG_PATH)) {
        console.error(`package.json not found at: ${PKG_PATH}`);
        process.exit(1);
    }
    assertNotIgnoredInGit(BUILD_DIR); // early check
})();

(async function main() {
    // 0) Clean state
    assertNoUnstagedChanges();

    // 1) Read version
    const pkg = readJson(PKG_PATH);
    const cur = pkg.version || '0.0.0';

    // 2) Ask what to bump
    const kind = await askBump(cur);
    const next = bumpSemver(cur, kind);

    // 3) Write version
    pkg.version = next;
    writeJson(PKG_PATH, pkg);
    console.log(`Version bumped: ${cur} -> ${next}`);

    // 4) Update README changelog
    updateReadme(next);

    // 5) **Frontend build before release** (in src-frontend)
    console.log(`\n🛠  Building frontend in ${FRONTEND_DIR} …`);
    try {
        sh('npm run build', { cwd: FRONTEND_DIR });
    } catch (e) {
        console.error('\n❌ Build failed. Aborting release.\n');
        process.exit(1);
    }
    if (!fs.existsSync(BUILD_DIR)) {
        console.error(`\n❌ Build output "${BUILD_DIR}" not found. Please check your build configuration.\n`);
        process.exit(1);
    }

    // 6) Commit & push (version + README + build output)
    try {
        if (fs.existsSync(README_PATH)) {
            sh(`git add "${PKG_PATH}" "${README_PATH}" "${BUILD_DIR}"`);
        } else {
            sh(`git add "${PKG_PATH}" "${BUILD_DIR}"`);
        }
    } catch {
        // Fallback: add -A for the build folder
        sh(`git add -A "${BUILD_DIR}"`);
        sh(`git add "${PKG_PATH}"`);
        if (fs.existsSync(README_PATH)) sh(`git add "${README_PATH}"`);
    }

    sh(`git commit -m "chore(release): v${next} (build)"`);
    sh(`git push`);

    // 7) Optional: create & push tag
    if (DO_TAG) {
        const tag = `v${next}`;
        try {
            sh(`git tag ${tag}`);
            sh(`git push origin ${tag}`);
            console.log(`Tag ${tag} created & pushed.`);
        } catch {
            console.warn(`Could not create/push tag ${tag}. Manually run:\n  git tag ${tag} && git push origin ${tag}`);
        }
    } else {
        console.log('NO_TAG is set — skipping tagging.');
    }

    console.log('\n✅ Done. Build committed and release commit pushed.');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
