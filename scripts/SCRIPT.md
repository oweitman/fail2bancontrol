# Frontend Release Script — Documentation

This script automates **version bumping, changelog update, build, commit, push, and optional tagging** for your frontend located in `src-frontend/`.

> **Location assumption:** Run the script **from inside `src-frontend/`**. It relies on `process.cwd()` being `src-frontend`.

---

## What it does (in order)

1. **Safety checks**

    - Aborts if there are **unstaged** or **staged-but-uncommitted** changes.
    - Aborts if the build output dir (default: `dist/`) is **ignored by `.gitignore`**.
    - Cleans the environment so `NODE_OPTIONS` (e.g., VS Code auto-attach) won’t interfere.

2. **Version bump (interactive)**

    - Reads `src-frontend/package.json` → `version`.
    - Prompts: bump **\[m]ajor / \[i]minor / \[p]atch**.
    - Writes the new semver back to `package.json`.

3. **README changelog update**

    - Looks for `<!-- CHANGELOG:INSERT -->` in `../README.md` (repo root).

        - If found, **inserts** a line `### vX.Y.Z — YYYY-MM-DD` directly **below** the marker.
        - If not found, **prepends** a `## Changelog` block with that entry.

4. **Build**

    - Runs `npm run build` in `src-frontend/`.
    - Verifies the build output directory exists (default: `dist/`).

5. **Commit & push**

    - Stages `src-frontend/package.json`, `../README.md` (if present), and build output dir.
    - Commits with message:
      `chore(release): vX.Y.Z (build)`
    - Pushes to the current branch.

6. **Optional Git tag**

    - By default, creates & pushes tag `vX.Y.Z`.
    - Skip by setting `NO_TAG=1`.

---

## File & Path layout

-   **Script CWD:** `src-frontend/`
-   **Reads/Writes**

    -   `src-frontend/package.json`
    -   `../README.md` (repo root)

-   **Build output**

    -   Default: `src-frontend/dist/`
    -   Override via `BUILD_DIR` env (see below)

---

## Environment variables

-   `BUILD_DIR` (optional): override build output folder name
    _Default_: `dist`
    _Example_: `BUILD_DIR=build`
-   `NO_TAG=1` (optional): skip creating & pushing git tag.
-   `NODE_OPTIONS` is automatically **stripped** for the build subprocess (to avoid auto-attach/debug flags issues).

---

## Usage

Make the script executable (once):

```bash
chmod +x scripts/release-frontend.js
```

Run it **from `src-frontend/`**:

```bash
# default (build to dist/, create tag vX.Y.Z)
./scripts/release-frontend.js

# or with Node
node ./scripts/release-frontend.js
```

Examples with environment variables:

```bash
# Use a different build dir
BUILD_DIR=build ./scripts/release-frontend.js

# Do everything except tagging
NO_TAG=1 ./scripts/release-frontend.js
```

> Tip: Consider running on a **temporary branch** if you want a safe dry run:
>
> ```
> git checkout -b release-test
> NO_TAG=1 ./scripts/release-frontend.js
> ```

---

## Interactive prompt

You’ll be asked:

```
What do you want to bump? [m]ajor / [i]minor / [p]atch
Choice (m/i/p):
```

-   `m` / `major` → `X+1.0.0`
-   `i` / `minor` → `X.Y+1.0`
-   anything else → `patch` (`X.Y.Z+1`)

---

## Commit & Tag behavior

-   **Commit message:** `chore(release): vX.Y.Z (build)`
-   **Includes in commit:**

    -   `src-frontend/package.json` (with bumped version)
    -   `../README.md` (changelog line added) — if it exists
    -   Build output directory (`dist/` by default)

-   **Tag:** `vX.Y.Z` (unless `NO_TAG=1`)
-   **Push:** commits and tag are pushed to origin.

> The script **aborts** if the build dir is ignored by `.gitignore` (to ensure the build artifacts are versioned as intended).

---

## Integrations (CI/CD)

-   **“Release from `src-frontend/package.json`” GitHub Action**
    After running this script, a commit with a **version bump** is pushed.
    Your Action will pick up the change in `src-frontend/package.json` and create a **GitHub Release** with tag `vX.Y.Z` (or use the tag this script already pushed).

-   **“Build & Push to Docker Hub”**
    If a tag `vX.Y.Z` is pushed, your Docker build workflow will:

    -   Build multi-arch images
    -   Push tag `X.Y.Z` (and `latest`, if enabled for tags)

---

## Customization

-   **Changelog marker:**
    The script looks for `<!-- CHANGELOG:INSERT -->` in `../README.md`.
    Change `CHANGELOG_MARKER` in the script to use a different marker.

-   **Changelog format:**
    The inserted line format is `### vX.Y.Z — YYYY-MM-DD`.
    Adjust `formatDateISO()` or the line composition inside `updateReadme()` as needed.

-   **Build command:**
    Currently `npm run build`. Change in:

    ```js
    sh('npm run build', { cwd: FRONTEND_DIR });
    ```

-   **Commit message or staged files:**
    Adjust the `git add` and `git commit -m` calls if you want a different message or additional files.

---

## Troubleshooting

-   **“There are unstaged/staged changes”**
    Commit or stash your work before running:

    ```bash
    git add -A && git commit -m "WIP"
    # or
    git stash
    ```

-   **Build fails / build dir not found**

    -   Check your frontend build script and output path.
    -   Ensure `BUILD_DIR` (if set) matches your actual output.
    -   The script will abort with a clear message if the output dir is missing.

-   **“Aborting: "dist" is ignored by .gitignore.”**
    Remove the build dir entry from `.gitignore` (or change `BUILD_DIR`).
    The script commits build artifacts by design.

-   **Tag already exists**
    You’ll see a warning. Delete or reuse:

    ```
    git tag -d vX.Y.Z
    git push origin :refs/tags/vX.Y.Z
    ```

    Then re-run (or set `NO_TAG=1`).

-   **Push errors (e.g., no upstream branch)**
    Set the upstream first:

    ```
    git push --set-upstream origin <your-branch>
    ```

-   **VS Code auto-attach / debug flags interfering**
    The script cleans `NODE_OPTIONS` for subprocesses. If you still see issues, check your terminal/session env.

---

## Notes

-   **Node & Git required:** The script uses `execSync` to run `git` and `npm`. Ensure both are installed and in PATH.
-   **Cross-platform:** Works on macOS/Linux and Windows (e.g., Git Bash). Paths are quoted for safety.
-   **Monorepo-friendly:** Paths are calculated relative to `src-frontend/` (current directory) and `..` (repo root).

---

## Example session

```text
$ cd src-frontend
$ ./scripts/release-frontend.js

Current version in src-frontend/package.json: 1.5.1
What do you want to bump? [m]ajor / [i]minor / [p]atch
Choice (m/i/p): p
Version bumped: 1.5.1 -> 1.5.2
README.md: Inserted entry below marker.

🛠  Building frontend in /path/to/repo/src-frontend …
# (build output…)

[master 1234abcd] chore(release): v1.5.2 (build)
 3 files changed, …
 Tag v1.5.2 created & pushed.

✅ Done. Build committed and release commit pushed.
```
