# Changelog

## 0.2.0

### Breaking

- `args` are no longer passed through the shell. With `args`, the command runs directly and each argument reaches it exactly as written. Before, arguments were joined with spaces and handed to `/bin/sh`, which split arguments containing spaces and let template parameters run as shell code. Without `args`, `command` still runs through the shell, so move any shell syntax there.

### Fixed

- A command killed by a signal (for example by the OOM killer) now fails the step. Before, it counted as a success with exit code 0.
- A relative `cwd` is resolved against the template workspace instead of the backend's working directory.

### Added

- The package default-exports a backend module, so installing is `backend.add(import('@ruivalim/shell-exec'))`.
- Tests.

### Changed

- Built against `@backstage/plugin-scaffolder-node` 0.13, now a regular dependency instead of a peer.
- Requires Node.js 22 or 24.
