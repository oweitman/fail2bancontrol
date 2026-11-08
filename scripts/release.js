#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const readline = require('readline');

const REPO_ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(REPO_ROOT, 'src-frontend');
const BUILD_DIR_NAME = process.env.BUILD_DIR || 'dist';
const BUILD_DIR = path.resolve(FRONTEND_DIR, BUILD_DIR_NAME);
const PKG_PATH = path.join(FRONTEND_DIR, 'package.json');
const LOCK_PATH = path.join(FRONTEND_DIR, 'package-lock.json');
const README_PATH = path.join(REPO_ROOT, 'README.md');
const CHANGELOG_MARKER = '<!-- CHANGELOG:INSERT -->';
const DO_TAG = process.env.NO_TAG !== '1';
const CLEAN_ENV = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== 'NODE_OPTIONS')
);

function run(command, args, { cwd = REPO_ROOT, capture = false } = {}) {
    return execFileSync(command, args, {
        cwd,
        env: CLEAN_ENV,
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        encoding: 'utf8',
    });
}
function git(args, options) {
    return run('git', args, options);
}
function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function assertVersionFiles(version) {
    const pkg = readJson(PKG_PATH);
    const lock = readJson(LOCK_PATH);
    if (pkg.version !== version || lock.version !== version
        || (lock.packages && lock.packages['']?.version !== version)) {
        throw new Error('package.json and package-lock.json versions do not match.');
    }
}
function assertTagAvailable(tag) {
    const local = git(['tag', '--list', tag], { capture: true }).trim();
    if (local) throw new Error(`Local tag ${tag} already exists. No release files were changed.`);
    try {
        git(['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`], { capture: true });
    } catch (error) {
        if (error.status === 2) return; // No matching remote tag.
        throw new Error(`Could not check tags on origin: ${error.stderr || error.message}`);
    }
    throw new Error(`Tag ${tag} already exists on origin. No release files were changed.`);
}
function assertBuildTracked() {
    try {
        git(['check-ignore', '-q', '--', BUILD_DIR], { capture: true });
    } catch (error) {
        if (error.status === 1) return;
        throw error;
    }
    throw new Error(`Build directory ${BUILD_DIR_NAME} is ignored by Git.`);
}
function updateReadme(version) {
    if (!fs.existsSync(README_PATH)) return;
    const raw = fs.readFileSync(README_PATH, 'utf8');
    const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const entry = `### v${version} — ${date}`;
    const updated = raw.includes(CHANGELOG_MARKER)
        ? raw.replace(CHANGELOG_MARKER, `${CHANGELOG_MARKER}\n${entry}`)
        : `## Changelog\n\n${entry}\n\n${raw}`;
    fs.writeFileSync(README_PATH, updated, 'utf8');
}
async function askBump(current) {
    console.log(`Current version: ${current}`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await new Promise((resolve, reject) => {
            rl.once('close', () => reject(new Error('Release cancelled.')));
            rl.once('SIGINT', () => reject(new Error('Release cancelled.')));
            rl.question('Bump [m]ajor / [i]minor / [p]atch (default p): ', resolve);
        });
        const choice = answer.trim().toLowerCase();
        if (choice === 'm' || choice === 'major') return 'major';
        if (choice === 'i' || choice === 'minor') return 'minor';
        if (!choice || choice === 'p' || choice === 'patch') return 'patch';
        throw new Error('Invalid choice. Use m, i, or p.');
    } finally {
        rl.close();
    }
}

async function main() {
    for (const file of [PKG_PATH, LOCK_PATH]) {
        if (!fs.existsSync(file)) throw new Error(`Required file missing: ${file}`);
    }
    const relativeBuild = path.relative(FRONTEND_DIR, BUILD_DIR);
    if (!relativeBuild || relativeBuild.startsWith('..') || path.isAbsolute(relativeBuild)
        || ['src', 'node_modules', 'public'].includes(relativeBuild.split(path.sep)[0])) {
        throw new Error('BUILD_DIR must be an output directory inside src-frontend (for example dist or build).');
    }
    const dirty = git(['status', '--porcelain', '--untracked-files=all'], { capture: true }).trim();
    if (dirty) throw new Error('Commit or stash all changes, including untracked files, before releasing.');
    const branch = git(['branch', '--show-current'], { capture: true }).trim();
    if (!branch) throw new Error('Cannot release from a detached HEAD.');
    if (DO_TAG && branch !== 'main') throw new Error('Publish tagged releases from main. Merge your feature branch first.');
    git(['remote', 'get-url', 'origin'], { capture: true });
    assertBuildTracked();
    const current = readJson(PKG_PATH).version;
    if (!/^\d+\.\d+\.\d+$/.test(current)) throw new Error('Expected a stable version in the form X.Y.Z.');
    assertVersionFiles(current);
    const kind = await askBump(current);
    const [major, minor, patch] = current.split('.').map(Number);
    const next = kind === 'major' ? `${major + 1}.0.0`
        : kind === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
    const tag = `v${next}`;
    if (DO_TAG) assertTagAvailable(tag);

    // npm updates both manifests, including the lockfile's root package entry.
    run('npm', ['version', next, '--no-git-tag-version', '--ignore-scripts'], { cwd: FRONTEND_DIR });
    assertVersionFiles(next);
    updateReadme(next);
    const buildArgs = ['run', 'build'];
    if (BUILD_DIR_NAME !== 'dist') buildArgs.push('--', '--outDir', BUILD_DIR);
    run('npm', buildArgs, { cwd: FRONTEND_DIR });
    if (!fs.existsSync(BUILD_DIR) || !fs.statSync(BUILD_DIR).isDirectory()
        || fs.readdirSync(BUILD_DIR).length === 0) {
        throw new Error(`Build output missing or empty: ${BUILD_DIR}`);
    }

    const files = [PKG_PATH, LOCK_PATH, BUILD_DIR];
    if (fs.existsSync(README_PATH)) files.push(README_PATH);
    git(['add', '-A', '--', ...files]);
    git(['commit', '-m', `chore(release): ${tag} (build)`]);
    if (DO_TAG) git(['tag', tag]);

    // Publish the branch and tag together so CI sees the same release commit.
    const refs = [`HEAD:refs/heads/${branch}`];
    if (DO_TAG) refs.push(`refs/tags/${tag}`);
    try {
        git(['push', '--atomic', 'origin', ...refs]);
    } catch {
        console.error(`Release commit${DO_TAG ? ' and tag' : ''} remain local. No automatic rollback was performed.`);
        console.error(`After resolving the push error, retry:\n  git push --atomic origin ${refs.join(' ')}`);
        throw new Error('Publication failed. Do not rerun the version bump to retry this release.');
    }
    console.log(`Release ${next} pushed successfully${DO_TAG ? ` with tag ${tag}. Docker publishing is now handled by GitHub Actions.` : '. NO_TAG=1: no tag was pushed; this does not trigger a tagged Docker release.'}`);
}

main().catch((error) => {
    console.error(`\nRelease aborted: ${error.message}`);
    process.exitCode = 1;
});
