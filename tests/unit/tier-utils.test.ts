import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canInstall,
  tierDisplayName,
  tierBadge,
  TIER_HIERARCHY,
} from "../../src/utils/tier.utils.js";

describe("tier.utils — TIER_HIERARCHY", () => {
  it("exports four tiers in ascending order", () => {
    assert.deepStrictEqual(TIER_HIERARCHY, [
      "starter",
      "complete",
      "pro",
      "enterprise",
    ]);
  });
});

describe("tier.utils — canInstall", () => {
  // Same-tier installs
  it("starter can install starter modules", () => {
    assert.strictEqual(canInstall("starter", "starter"), true);
  });

  it("complete can install complete modules", () => {
    assert.strictEqual(canInstall("complete", "complete"), true);
  });

  it("pro can install pro modules", () => {
    assert.strictEqual(canInstall("pro", "pro"), true);
  });

  it("enterprise can install enterprise modules", () => {
    assert.strictEqual(canInstall("enterprise", "enterprise"), true);
  });

  // Upward access
  it("complete can install starter modules", () => {
    assert.strictEqual(canInstall("complete", "starter"), true);
  });

  it("pro can install starter and complete modules", () => {
    assert.strictEqual(canInstall("pro", "starter"), true);
    assert.strictEqual(canInstall("pro", "complete"), true);
  });

  it("enterprise can install everything", () => {
    assert.strictEqual(canInstall("enterprise", "starter"), true);
    assert.strictEqual(canInstall("enterprise", "complete"), true);
    assert.strictEqual(canInstall("enterprise", "pro"), true);
  });

  // Downward blocks
  it("starter cannot install complete modules", () => {
    assert.strictEqual(canInstall("starter", "complete"), false);
  });

  it("starter cannot install pro modules", () => {
    assert.strictEqual(canInstall("starter", "pro"), false);
  });

  it("complete cannot install pro modules", () => {
    assert.strictEqual(canInstall("complete", "pro"), false);
  });

  it("pro cannot install enterprise modules", () => {
    assert.strictEqual(canInstall("pro", "enterprise"), false);
  });

  // Case-insensitive (API returns uppercase)
  it("handles uppercase tier strings from API", () => {
    assert.strictEqual(canInstall("COMPLETE", "STARTER"), true);
    assert.strictEqual(canInstall("STARTER", "COMPLETE"), false);
    assert.strictEqual(canInstall("PRO", "COMPLETE"), true);
  });

  it("handles mixed case tier strings", () => {
    assert.strictEqual(canInstall("Pro", "complete"), true);
    assert.strictEqual(canInstall("Starter", "PRO"), false);
  });

  // Unknown / undefined tiers default to starter
  it("undefined user tier defaults to starter (can install starter)", () => {
    assert.strictEqual(canInstall(undefined, "starter"), true);
  });

  it("undefined user tier defaults to starter (cannot install complete)", () => {
    assert.strictEqual(canInstall(undefined, "complete"), false);
  });

  it("undefined module tier defaults to starter (always installable)", () => {
    assert.strictEqual(canInstall("starter", undefined), true);
    assert.strictEqual(canInstall(undefined, undefined), true);
  });

  it("unknown tier strings default to starter", () => {
    // Unknown user → starter; can install starter modules
    assert.strictEqual(canInstall("gold", "starter"), true);
    // Unknown user → starter; cannot install complete modules
    assert.strictEqual(canInstall("gold", "complete"), false);
    // Unknown module → starter; starter user can install
    assert.strictEqual(canInstall("starter", "diamond"), true);
  });
});

describe("tier.utils — tierDisplayName", () => {
  it("returns proper display names for known tiers (lowercase)", () => {
    assert.strictEqual(tierDisplayName("starter"), "Starter");
    assert.strictEqual(tierDisplayName("complete"), "Complete");
    assert.strictEqual(tierDisplayName("pro"), "Pro");
    assert.strictEqual(tierDisplayName("enterprise"), "Enterprise");
  });

  it("handles uppercase tier strings from API", () => {
    assert.strictEqual(tierDisplayName("STARTER"), "Starter");
    assert.strictEqual(tierDisplayName("COMPLETE"), "Complete");
    assert.strictEqual(tierDisplayName("PRO"), "Pro");
    assert.strictEqual(tierDisplayName("ENTERPRISE"), "Enterprise");
  });

  it("returns original string for unknown tiers", () => {
    assert.strictEqual(tierDisplayName("gold"), "gold");
  });

  it("defaults to 'Starter' for undefined", () => {
    assert.strictEqual(tierDisplayName(undefined), "Starter");
  });
});

describe("tier.utils — tierBadge", () => {
  it("wraps display name in brackets", () => {
    assert.strictEqual(tierBadge("starter"), "[Starter]");
    assert.strictEqual(tierBadge("complete"), "[Complete]");
    assert.strictEqual(tierBadge("pro"), "[Pro]");
    assert.strictEqual(tierBadge("enterprise"), "[Enterprise]");
  });

  it("handles uppercase tier strings", () => {
    assert.strictEqual(tierBadge("STARTER"), "[Starter]");
    assert.strictEqual(tierBadge("PRO"), "[Pro]");
  });

  it("defaults to '[Starter]' for undefined", () => {
    assert.strictEqual(tierBadge(undefined), "[Starter]");
  });
});
