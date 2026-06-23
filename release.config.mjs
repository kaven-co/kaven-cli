/**
 * Semantic Release configuration for kaven-cli.
 *
 * Channel strategy:
 *  - main branch → publishes to npm dist-tag "latest" (default)
 *  - No channel override: semantic-release defaults to @latest for the main branch
 *
 * Note: `prerelease` flag is intentionally absent.
 * Version numbers are clean semver (e.g. 0.12.0).
 */

export default {
  branches: [
    {
      name: 'main',
    },
  ],

  plugins: [
    // 1. Analyze commits to determine version bump
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'revert', release: 'patch' },
          { breaking: true, release: 'major' },
          // chore, docs, test, style, ci → no release
        ],
      },
    ],

    // 2. Generate changelog content
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'angular',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'perf', section: 'Performance' },
            { type: 'refactor', section: 'Refactoring' },
            { type: 'revert', section: 'Reverts' },
          ],
        },
      },
    ],

    // 3. Update CHANGELOG.md
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],

    // 4. Publish to npm (uses OIDC via Trusted Publisher — no token needed)
    //    Publishes to @latest by default (no channel override)
    [
      '@semantic-release/npm',
      {
        npmPublish: true,
        pkgRoot: '.',
      },
    ],

    // 5. Commit package.json + CHANGELOG.md back to main
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'pnpm-lock.yaml', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],

    // 6. Create GitHub release
    [
      '@semantic-release/github',
      {
        assets: [],
      },
    ],
  ],
};
