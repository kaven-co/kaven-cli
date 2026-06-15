/**
 * Tier hierarchy utilities for Kaven CLI.
 * Normalizes tier strings (case-insensitive) and provides comparison helpers.
 */

export const TIER_HIERARCHY = ["starter", "complete", "pro", "enterprise"] as const;
export type KavenTier = (typeof TIER_HIERARCHY)[number];

/** Normalize any tier string to lowercase for comparison. */
function normalizeTier(tier: string | undefined): string {
  return (tier ?? "starter").toLowerCase();
}

/**
 * Returns true if the user's tier is sufficient to install a module
 * that requires `moduleTier`.
 *
 * Unknown tier values default to "starter" (safe fail).
 */
export function canInstall(
  userTier: string | undefined,
  moduleTier: string | undefined
): boolean {
  const userNorm = normalizeTier(userTier);
  const moduleNorm = normalizeTier(moduleTier);

  const userIdx = TIER_HIERARCHY.indexOf(userNorm as KavenTier);
  const moduleIdx = TIER_HIERARCHY.indexOf(moduleNorm as KavenTier);

  // Unknown tiers default to index 0 (starter) — safe fail
  const effectiveUser = userIdx >= 0 ? userIdx : 0;
  const effectiveModule = moduleIdx >= 0 ? moduleIdx : 0;

  return effectiveUser >= effectiveModule;
}

/** Human-readable display name for a tier string. */
export function tierDisplayName(tier: string | undefined): string {
  const norm = normalizeTier(tier);
  const names: Record<string, string> = {
    starter: "Starter",
    complete: "Complete",
    pro: "Pro",
    enterprise: "Enterprise",
  };
  return names[norm] ?? (tier ?? "Starter");
}

/** Short badge label, e.g. "[Complete]". */
export function tierBadge(tier: string | undefined): string {
  return `[${tierDisplayName(tier)}]`;
}
