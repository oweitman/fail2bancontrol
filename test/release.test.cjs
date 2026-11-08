// Run from the repository root: node --test test/release.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['NODE_TEST_CONTEXT', 'NODE_OPTIONS'].includes(key)));


function fixture(t, buildFails = false) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'f2b release test '));
    t.after(() => fs.rmSync(base, { recursive: true, force: true }));
    const root = path.join(base, 'repo');
    const remote = path.join(base, 'origin.git');
    fs.mkdirSync(root);
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '--bare', '--initial-branch=main', remote);
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Release Test');
    git('config', 'user.email', 'release-test@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    git('remote', 'add', 'origin', remote);
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.copyFileSync(path.resolve(__dirname, '../scripts/release.js'), path.join(root, 'scripts/release.js'));
    const frontend = path.join(root, 'src-frontend');
    fs.mkdirSync(path.join(frontend, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(frontend, 'dist/old.js'), 'old build');
    const pkg = { name: 'release-fixture', version: '1.9.2', private: true, scripts: { build: 'node build.cjs' } };
    fs.writeFileSync(path.join(frontend, 'package.json'), JSON.stringify(pkg));
    fs.writeFileSync(path.join(frontend, 'package-lock.json'), JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: 3, requires: true, packages: { '': { name: pkg.name, version: pkg.version } } }));
    fs.writeFileSync(path.join(frontend, 'build.cjs'), buildFails ? 'process.exit(1);' : `
        const fs = require('fs');
        const dest = process.argv.includes('--outDir') ? process.argv[process.argv.indexOf('--outDir') + 1] : 'dist';
        fs.rmSync(dest, { recursive: true, force: true });
        fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(dest + '/index.html', require('./package.json').version);
    `);
    fs.writeFileSync(path.join(root, 'README.md'), '# Test\n\n<!-- CHANGELOG:INSERT -->\n');
    fs.writeFileSync(path.join(root, '.gitignore'), 'src-frontend/node_modules/\n');
    git('add', '.');
    git('commit', '-m', 'Initial fixture');
    git('push', 'origin', 'main');
    const initial = git('rev-parse', 'HEAD');
    const read = file => fs.readFileSync(path.join(root, file), 'utf8');
    const release = (env = {}, input = 'i\n') => spawnSync(process.execPath, [path.join(root, 'scripts/release.js')], {
        cwd: root, input, encoding: 'utf8', env: { ...childEnv, ...env }, timeout: 30000,
    });
    return { root, frontend, remote, git, initial, read, release };
}

function assertFailed(result, message) {
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, message);
}

test('minor release updates, commits and atomically pushes manifest, lockfile, build and tag', t => {
    const f = fixture(t);
    const result = f.release();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const file of ['package.json', 'package-lock.json']) {
        const manifest = JSON.parse(f.read('src-frontend/' + file));
        assert.equal(manifest.version, '1.10.0');
        if (manifest.packages) assert.equal(manifest.packages[''].version, '1.10.0');
    }
    assert.equal(f.read('src-frontend/dist/index.html'), '1.10.0');
    assert.match(f.read('README.md'), /### v1\.10\.0 — \d{4}-\d{2}-\d{2}/);
    assert.equal(f.git('status', '--porcelain'), '');
    const commit = f.git('rev-parse', 'HEAD');
    assert.equal(f.git('rev-parse', 'v1.10.0'), commit);
    assert.equal(f.git('--git-dir=' + f.remote, 'rev-parse', 'main'), commit);
    assert.equal(f.git('--git-dir=' + f.remote, 'rev-parse', 'v1.10.0'), commit);
    assert.match(f.git('show', '--format=', '--name-status', 'HEAD'), /D\s+src-frontend\/dist\/old.js/);
    execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: f.frontend, stdio: 'pipe' });
});

test('build failure does not commit, tag or push', t => {
    const f = fixture(t, true);
    assertFailed(f.release(), /Release aborted/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.initial);
    assert.equal(f.git('tag', '--list'), '');
    assert.equal(f.git('--git-dir=' + f.remote, 'rev-parse', 'main'), f.initial);
});

test('existing local tag aborts before changing release files', t => {
    const f = fixture(t);
    f.git('tag', 'v1.10.0');
    assertFailed(f.release(), /Local tag v1.10.0 already exists/);
    assert.equal(f.git('status', '--porcelain'), '');
});

test('existing remote tag aborts before changing release files', t => {
    const f = fixture(t);
    f.git('tag', 'v1.10.0');
    f.git('push', 'origin', 'v1.10.0');
    f.git('tag', '-d', 'v1.10.0');
    assertFailed(f.release(), /already exists on origin/);
    assert.equal(f.git('status', '--porcelain'), '');
});

test('dirty tracked or untracked files prevent a release', t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.root, 'untracked.txt'), 'pending');
    assertFailed(f.release(), /including untracked files/);
    fs.unlinkSync(path.join(f.root, 'untracked.txt'));
    fs.appendFileSync(path.join(f.root, 'README.md'), 'pending');
    assertFailed(f.release(), /Commit or stash/);
    assert.equal(JSON.parse(f.read('src-frontend/package.json')).version, '1.9.2');
});

test('tagged releases are restricted to main', t => {
    const f = fixture(t);
    f.git('switch', '-c', 'feature');
    assertFailed(f.release(), /Publish tagged releases from main/);
    assert.equal(f.git('status', '--porcelain'), '');
});

test('NO_TAG still pushes the commit but does not create a release tag', t => {
    const f = fixture(t);
    const result = f.release({ NO_TAG: '1' }, 'p\n');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(f.git('tag', '--list'), '');
    assert.equal(JSON.parse(f.read('src-frontend/package-lock.json')).version, '1.9.3');
    assert.equal(f.git('--git-dir=' + f.remote, 'rev-parse', 'main'), f.git('rev-parse', 'HEAD'));
});

test('atomic push failure leaves remote branch unchanged and reports recovery command', t => {
    const f = fixture(t);
    const hook = path.join(f.remote, 'hooks/update');
    fs.writeFileSync(hook, '#!/bin/sh\ncase "$1" in refs/tags/*) exit 1;; esac\nexit 0\n', { mode: 0o755 });
    assertFailed(f.release(), /git push --atomic origin HEAD:refs\/heads\/main refs\/tags\/v1.10.0/);
    assert.equal(f.git('--git-dir=' + f.remote, 'rev-parse', 'main'), f.initial);
    assert.notEqual(f.git('rev-parse', 'HEAD'), f.initial);
    assert.equal(f.git('rev-parse', 'v1.10.0'), f.git('rev-parse', 'HEAD'));
});

test('custom build directory is passed to the build and committed', t => {
    const f = fixture(t);
    const result = f.release({ BUILD_DIR: 'custom build' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(f.read('src-frontend/custom build/index.html'), '1.10.0');
    assert.equal(f.git('status', '--porcelain'), '');
});

test('invalid input leaves release files untouched', t => {
    const f = fixture(t);
    assertFailed(f.release({}, 'invalid\n'), /Invalid choice/);
    assert.equal(f.git('status', '--porcelain'), '');
});
