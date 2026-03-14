/**
 * Semantic Release configuration for kaven-cli.
 *
 * Channel strategy:
 *  - main branch → publishes to npm tag "alpha" (pre-release channel)
 *  - When ready to go stable: change branch config to remove prerelease flag
 */

export default {
  branches: [
    {
      name: 'main',
      prerelease: 'alpha',
      channel: 'alpha',
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
    [
      '@semantic-release/npm',
      {
        npmPublish: true,
        pkgRoot: '.',
        // tag is derived from the branch channel above ("alpha")
      },
    ],

    // 5. Create GitHub release + commit version bump + changelog
    [
      '@semantic-release/github',
      {
        assets: [],
      },
    ],
  ],
};
