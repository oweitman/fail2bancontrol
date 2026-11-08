# Release script

`scripts/release.js` prepares and publishes a versioned frontend build. The default
flow creates a release commit and pushes it together with a version tag. That tag
starts the repository's Docker Hub publishing workflow.

## Publishing 1.10.0

First commit or stash all existing work, including changes to this release script.
Use `main` and ensure its history is ready to push to `origin`.

From the development container:

```bash
cd /workspaces/fail2bancontrol/src-frontend
npm run release
```

At the prompt, choose **`i`** (minor) to change `1.9.2` to `1.10.0`:

```text
Current version: 1.9.2
Bump [m]ajor / [i]minor / [p]atch (default p): i
```

The script can also be invoked from the repository root:

```bash
node scripts/release.js
```

Paths are resolved relative to the script, independently of the terminal's current
directory. Run Git commands without sudo; the normal development user must own the
repository files.

## What the script does

1. Checks that `package.json` and `package-lock.json` exist and their versions match.
   Also checks that the working tree and index are clean, including untracked files,
   that `origin` exists, and that the build directory is not ignored by Git.
2. Requires `main` for tagged releases and rejects a detached HEAD.
3. Prompts for a major, minor, or patch increase. Empty input defaults to patch;
   invalid input aborts without changing release files.
4. Checks that the target tag exists neither locally nor on `origin`. Failure to
   contact the remote aborts before version files are changed.
5. Runs `npm version X.Y.Z --no-git-tag-version --ignore-scripts` in `src-frontend`.
   This updates both package files, including the lockfile's root package version,
   without running version lifecycle scripts or creating npm's own commit/tag.
6. Adds a dated heading below `<!-- CHANGELOG:INSERT -->` in `README.md`, if present.
   Dates use the `Europe/Berlin` time zone. If the marker is absent, a changelog
   section is prepended. Release notes themselves are not generated locally.
7. Runs `npm run build` and checks that the output directory exists and is nonempty.
8. Stages `package.json`, `package-lock.json`, the build output including removed
   assets, and `README.md` if present. Creates `chore(release): vX.Y.Z (build)`.
9. Creates the local tag `vX.Y.Z`.
10. Pushes the current branch and tag to `origin` in one atomic Git push. Both
    references must be accepted; otherwise neither reference is published.

The push includes earlier local commits on the branch as well as the release
commit. `NODE_OPTIONS` is removed from subprocess environments so VS Code's
Node auto-attach options do not interfere. Commands use argument arrays rather
than shell interpolation, including when paths contain spaces.

## Version choices

| Input | Result from 1.9.2 |
| --- | --- |
| `m` or `major` | `2.0.0` |
| `i` or `minor` | `1.10.0` |
| `p`, `patch`, or empty input | `1.9.3` |

The script expects a stable version in the form `X.Y.Z`.

## Docker Hub and GitHub integration

The script pushes the tag; GitHub Actions performs the image build and upload.
For `v1.10.0`, the configured Docker workflow publishes:

- `oweitman/fail2bancontrol:1.10.0`
- `oweitman/fail2bancontrol:latest`

Images are built for `linux/amd64` and `linux/arm64`. The workflow requires valid
repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.
A successful script run means Git accepted the push, not that the asynchronous
Docker build has finished. Check [GitHub Actions](https://github.com/oweitman/fail2bancontrol/actions)
for its result. The existing package-change workflow also creates or updates the
GitHub Release corresponding to the version tag.

## Environment options

| Variable | Behavior |
| --- | --- |
| `NO_TAG=1` | Skips the local tag and its push; the release commit is still created and pushed to `origin`. Allows branches other than `main`. |
| `BUILD_DIR=build` | Uses another output directory inside `src-frontend` and passes `--outDir` to the Vite build. Default: `dist`. |

`NO_TAG=1` is **not a dry run** and does not disable the repository's package-change
GitHub Release workflow on `main`. Use a disposable local repository for tests
without publishing anything.

The production Dockerfile expects `src-frontend/dist`. A custom `BUILD_DIR` is for
other build arrangements and does not automatically change the Dockerfile.

## Failure handling

- **Uncommitted work:** Commit or stash it, including untracked files, before running.
- **Version mismatch or missing lockfile:** Restore a consistent, committed pair of
  package files before trying again.
- **Tag already exists:** Inspect the existing release and choose an appropriate
  next version. The script does not delete or overwrite tags.
- **Build fails:** No release commit, tag, or push is performed. Version/changelog
  and partial build changes may remain locally so they can be inspected or repaired.
- **Push fails:** The release commit and tag remain local. The script exits with an
  error and prints the exact push command to retry. Fix the Git/remote problem and
  retry that command instead of running another version bump. For example:

  ```bash
  git push --atomic origin HEAD:refs/heads/main refs/tags/v1.10.0
  ```

  If the remote rejects atomic pushes, the script does not fall back to separate
  pushes. This avoids publishing only part of a release.

## Tests

From the repository root:

```bash
node --test test/release.test.cjs
```

The tests use disposable repositories and local bare remotes. They verify matching
manifest/lockfile versions, build artifacts, committed deletions, published tags,
build failures, existing tags, dirty worktrees, branch restrictions, custom output
directories, and atomic push rejection. They do not contact GitHub or Docker Hub.
