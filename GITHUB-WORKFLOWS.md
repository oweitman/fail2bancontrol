# GitHub Actions – Documentation

This document describes the three workflows in your repository: what they do, when they run, the required secrets/environment variables, and how to use and troubleshoot them.

---

## Overview

| Workflow                                   | Purpose                                                                           | Triggers                                                                        | Key Secrets / Env                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Sync Docker Hub README**                 | Syncs your repo’s `README.md` to Docker Hub                                       | Push to `main` (when `README.md` or the workflow file changes), or manual       | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` · `IMAGE_NAME` |
| **Build & Push to Docker Hub**             | Builds multi-arch images and pushes tags (optionally `latest`)                    | Tags (`v*`, `release-*`), manual runs, or Push/PR with **`[build image]`** flag | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` · `IMAGE_NAME` |
| **Release from src-frontend/package.json** | Creates a GitHub Release from the version declared in `src-frontend/package.json` | Push to `main` changing `src-frontend/package.json`, or manual                  | Uses built-in `GITHUB_TOKEN` (no extra secret)         |

> `IMAGE_NAME` is set at the workflow level (e.g., `oweitman/fail2bancontrol`). Adjust it to your Docker Hub repository if needed.

---

## 1) Sync Docker Hub README

**File:** `.github/workflows/dockerhub-readme.yml` (name may differ in your repo)

### What it does

-   Reads your local `README.md` and updates the **Description/README** of the Docker Hub repository specified by `IMAGE_NAME`.
-   Uses [`peter-evans/dockerhub-description`](https://github.com/peter-evans/dockerhub-description) with URL completion enabled (relative links become absolute).

### Triggers

-   `push` to `main` when `README.md` or the workflow file changes.
-   `workflow_dispatch` to run it manually from the Actions tab.

### Requirements

-   **Secrets**

    -   `DOCKERHUB_USERNAME`
    -   `DOCKERHUB_TOKEN` (Docker Hub Personal Access Token with **read/write/delete** permissions, as recommended by the action)

-   **Env**

    -   `IMAGE_NAME` (e.g., `oweitman/fail2bancontrol`)

### Config notes

-   `readme-filepath`: set to `./README.md` (change if you keep a separate Docker README).
-   `short-description`: uses the GitHub repository description.

---

## 2) Build & Push to Docker Hub

**File:** `.github/workflows/dockerhub.yml` (name may differ)

### What it does

-   Sets up QEMU and Buildx, then **builds multi-architecture images** (`linux/amd64`, `linux/arm64`).
-   Generates **tags & labels** via `docker/metadata-action`.
-   **Pushes** only when allowed (see conditions below); otherwise performs a build-only run (e.g., for PRs).

### Triggers

-   `push` to `main` **and**:

    -   Tag push (`v*`, `release-*`) → **always** build & push
    -   Commit message contains **`[build image]`** → build; push only on `main`

-   `pull_request` to `main` **and** PR title/body contains **`[build image]`** → build (no push)
-   `workflow_dispatch` (manual) → build & push

### Push conditions (expressed in the YAML)

-   **Login to Docker Hub** only if:

    -   Tag build, **or**
    -   manual run, **or**
    -   push on `main` **with** `"[build image]"` in the commit message

-   **`docker/build-push-action` → `push:`** is `true` if:

    -   Tag build, **or**
    -   manual run, **or**
    -   push on `main` **with** `"[build image]"` in the commit message

> For PRs (even with `"[build image]"`), no push is performed — this protects Docker Hub secrets from forked repos.

### Tagging & labels

-   **Tags**:

    -   `type=semver,pattern={{version}},event=tag` → for `v1.2.3` you get tag `1.2.3`.
    -   Optional `latest` is enabled **only for tag builds**.

-   **Labels**:

    -   `org.opencontainers.image.source`, `revision`, `title` are set for traceability.

### Build parameters

-   `context: .`
-   `file: ./dockerfile` (adjust if your Dockerfile has a different path/name)
-   `platforms: linux/amd64,linux/arm64`
-   Caching via GitHub Actions cache (`cache-from`/`cache-to`).
-   `provenance` mirrors your push conditions (true on push), enabling BuildKit attestations/SBOM when applicable.

### Requirements

-   **Secrets**

    -   `DOCKERHUB_USERNAME`
    -   `DOCKERHUB_TOKEN`

-   **Env**

    -   `IMAGE_NAME` (e.g., `oweitman/fail2bancontrol`)

### How to use in practice

-   **Release build:** Create and push a Git tag `v1.2.3` → image builds and is pushed with tag `1.2.3` (and `latest`).
-   **On-demand build on `main`:** Include `"[build image]"` in the commit message → image builds and is pushed.
-   **PR test build (no push):** Include `"[build image]"` in the PR title or description.

---

## 3) Release from `src-frontend/package.json`

**File:** `.github/workflows/release.yml` (name may differ)

### What it does

-   Reads the **version** from `src-frontend/package.json`.
-   Creates a GitHub **Release** with tag `v<version>` (e.g., `v1.5.1`) and auto-generated release notes.

### Triggers

-   `push` to `main` when `src-frontend/package.json` changes.
-   `workflow_dispatch` (manual).

### Steps overview

1. Checkout (with `fetch-depth: 0` to allow proper release notes).
2. Setup Node 20 (used to read the version via `node -p`).
3. Read version:

    ```bash
    node -p "require('./src-frontend/package.json').version"
    ```

    → sets `steps.pkg.outputs.version` and `steps.pkg.outputs.tag` (`v<version>`).

4. Create the release using `softprops/action-gh-release` with the built-in `GITHUB_TOKEN`.

### Requirements

-   No extra secrets needed; `GITHUB_TOKEN` is automatically provided.
    (`permissions.contents: write` is configured in the workflow.)

---

## Configuration & Customization

-   **`IMAGE_NAME`** (Docker workflows): set under `env:` to your Docker Hub repo (e.g., `myuser/myimage`).
-   **Dockerfile path:** change `file: ./dockerfile` if your file is named `Dockerfile` or lives elsewhere.
-   **Additional platforms:** extend `platforms:` (e.g., `linux/arm/v7`) if you need more targets.
-   **Tagging scheme:** tweak `docker/metadata-action` to add branch, SHA, or date-based tags if desired.
-   **README source:** change `readme-filepath` if you maintain a dedicated Docker README.

---

## Required Secrets (summary)

| Secret               | Used by                   | Purpose                            |
| -------------------- | ------------------------- | ---------------------------------- |
| `DOCKERHUB_USERNAME` | Sync README, Build & Push | Docker Hub login                   |
| `DOCKERHUB_TOKEN`    | Sync README, Build & Push | Docker Hub PAT (read/write/delete) |
| `GITHUB_TOKEN`       | Release (built-in)        | Create GitHub releases             |

> Create the Docker Hub PAT in your Docker Hub account settings. The description sync action recommends read/write/delete permissions.

---

## FAQs & Troubleshooting

-   **“Why doesn’t my PR push images?”**
    By design: PR builds compile but **do not push** to protect secrets (especially from forks).

-   **“Why didn’t a push to `main` build an image?”**
    For branch pushes, the workflow only builds & pushes when the commit message contains `"[build image]"`. Use a tag or a manual run otherwise.

-   **“`latest` wasn’t created.”**
    `latest` is enabled **only for tag builds**.

-   **“Docker Hub README sync failed.”**
    Check `DOCKERHUB_*` secrets, `IMAGE_NAME`, token permissions, and that the Docker Hub repository exists.

-   **“Release wasn’t created although the version changed.”**
    Ensure the change to `src-frontend/package.json` was pushed to `main` (path filter). Also ensure `version` is a valid semver (e.g., `1.5.1`).

---

## Examples

**Create a tag release:**

```bash
# bump version, commit, tag and push
git tag v1.6.0
git push origin v1.6.0
```

**On-demand image build & push (without a tag):**

```
Commit message on main: "Fix nginx headers [build image]"
# push to main → the image is built & pushed
```

**PR build (no push):**

-   PR title: `Refactor ban list [build image]`
    or
-   PR description includes `… [build image] …`

---

If you want, I can also generate a small “CI/CD” section for your project’s main `README.md` (badges + quick how-to) based on these workflows.
