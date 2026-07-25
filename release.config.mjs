const patchTypes = [
  "fix",
  "hotfix",
  "perf",
  "refactor",
  "build",
  "ci",
  "docs",
  "style",
  "test",
  "chore",
  "deps",
  "revert",
];

const releaseRules = [
  { type: "chore", scope: "release", release: false },
  { type: "feat", release: "minor" },
  { type: "content", release: "minor" },
  ...patchTypes.map((type) => ({ type, release: "patch" })),
];

const changelogTypes = [
  { type: "feat", section: "Features" },
  { type: "content", section: "Features" },
  { type: "fix", section: "Bug Fixes" },
  { type: "hotfix", section: "Bug Fixes" },
  { type: "perf", section: "Performance" },
  { type: "refactor", section: "Refactoring" },
  { type: "deps", section: "Dependencies" },
  { type: "build", section: "Build System" },
  { type: "ci", section: "Continuous Integration" },
  { type: "docs", section: "Documentation" },
  { type: "test", section: "Tests" },
  { type: "style", section: "Code Style" },
  { type: "chore", section: "Maintenance" },
  { type: "revert", section: "Reverts" },
];

export default {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules,
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: changelogTypes,
        },
      },
    ],
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle:
          "# Changelog\n\nAll notable changes to ApexHUD are documented here.",
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          "node scripts/prepare-release.mjs ${nextRelease.version} && npm run build && npm exec --workspace @apexhud/desktop -- electron-builder --win portable --x64 --publish never",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: [
          "CHANGELOG.md",
          "package.json",
          "package-lock.json",
          "apps/desktop/package.json",
          "packages/protocol/package.json",
          "services/telemetry/ApexHUD.Telemetry.csproj",
        ],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: [
          {
            path: "apps/desktop/release/ApexHUD-*-x64.exe",
            label: "ApexHUD portable for Windows x64",
          },
        ],
        successComment: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
  ],
};
