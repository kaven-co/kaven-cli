/**
 * Semantic Release configuration for kaven-cli.
 *
 * Channel strategy:
 *  - main branch → publishes to npm dist-tag "alpha"
 *    (users install with: npm install kaven-cli@alpha)
 *  - When ready to go stable: remove the `channel` property
 *
 * Note: `prerelease` flag is intentionally absent.
 * semantic-release v25 requires at least one non-prerelease release branch.
 * Using `channel: 'alpha'` achieves the same distribution goal (alpha dist-tag)
 * without the single-branch limitation. Version numbers are clean semver (e.g. 0.5.0).
 */

export default {
  branches: [
    {
      name: 'main',
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
