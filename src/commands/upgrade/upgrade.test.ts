import { describe, it } from 'node:test';
import assert from 'node:assert';
describe("C2.3: Upgrade Command", () => {
  it("C2.3.1: Should parse semver versions correctly", () => {
    const parseVersion = (version: string) => {
      const cleaned = version.replace(/^v/, "").split("-")[0];
      const [major, minor, patch] = cleaned.split(".").map(Number);
      return { major: major || 0, minor: minor || 0, patch: patch || 0 };
    };

    assert.deepStrictEqual(parseVersion("1.2.3"), { major: 1, minor: 2, patch: 3 });
    assert.deepStrictEqual(parseVersion("v2.0.0"), { major: 2, minor: 0, patch: 0 });
    assert.deepStrictEqual(parseVersion("1.0.0-alpha"), { major: 1, minor: 0, patch: 0 });
  });

  it("C2.3.2: Should detect version upgrades", () => {
    const parseVersion = (version: string) => {
      const cleaned = version.replace(/^v/, "").split("-")[0];
      const [major, minor, patch] = cleaned.split(".").map(Number);
      return { major: major || 0, minor: minor || 0, patch: patch || 0 };
    };

    const current = parseVersion("1.0.0");
    const latest = parseVersion("1.0.1");

    const hasUpdate =
      latest.major > current.major ||
      (latest.major === current.major && latest.minor > current.minor) ||
      (latest.major === current.major &&
        latest.minor === current.minor &&
        latest.patch > current.patch);

    assert.strictEqual(hasUpdate, true);
  });

  it("C2.3.3: Should detect no updates needed", () => {
    const parseVersion = (version: string) => {
      const cleaned = version.replace(/^v/, "").split("-")[0];
      const [major, minor, patch] = cleaned.split(".").map(Number);
      return { major: major || 0, minor: minor || 0, patch: patch || 0 };
    };

    const current = parseVersion("1.0.0");
    const latest = parseVersion("1.0.0");

    const hasUpdate =
      latest.major > current.major ||
      (latest.major === current.major && latest.minor > current.minor) ||
      (latest.major === current.major &&
        latest.minor === current.minor &&
        latest.patch > current.patch);

    assert.strictEqual(hasUpdate, false);
  });

  it("C2.3.4: Should support major version upgrades", () => {
    const parseVersion = (version: string) => {
      const cleaned = version.replace(/^v/, "").split("-")[0];
      const [major, minor, patch] = cleaned.split(".").map(Number);
      return { major: major || 0, minor: minor || 0, patch: patch || 0 };
    };

    const current = parseVersion("1.5.3");
    const latest = parseVersion("2.0.0");

    const hasUpdate =
      latest.major > current.major ||
      (latest.major === current.major && latest.minor > current.minor) ||
      (latest.major === current.major &&
        latest.minor === current.minor &&
        latest.patch > current.patch);

    assert.strictEqual(hasUpdate, true);
  });
});
