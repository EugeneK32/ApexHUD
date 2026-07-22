# Community modules

[Russian version](../ru/community-modules.md)

The default Git catalog is `https://github.com/EugeneK32/apexhud-community-modules.git`. ApexHUD clones or fetches it into application user data, checks out the configured branch, initializes submodules, scans module manifests, and compares installed versions.

Each catalog module must be self-contained and include a valid `manifest.json`. A `LICENSE` file is required for the official catalog. Recommended metadata: `README.md`, `README.ru.md`, and a `960×540` WebP preview.

Supported preview names are `preview.webp/png/jpg/jpeg` and the same names under `assets/`. Modules are installed atomically through a temporary directory; repository `.git` metadata is not copied into the user module directory.

Git discovery order: `APEXHUD_GIT_PATH`, packaged `resources/bin/git/cmd/git.exe`, packaged `resources/bin/git.exe`, source-tree `bin/git/cmd/git.exe`, then `PATH`.

Catalog authors should tag releases, use semantic versions, avoid remote runtime assets, keep modules sandbox-compatible, and request the smallest telemetry scope set. A module update may change files but must preserve `manifest.id`; breaking persisted settings should use new setting keys or careful migration in module JavaScript.
