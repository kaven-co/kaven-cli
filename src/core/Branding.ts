import pc from "picocolors";

/**
 * High-legibility Block ASCII Art for Kaven CLI
 * Optimized for both small and large terminals.
 */
const KAVEN_BLOCK_ASCII = `
 ██╗  ██╗ █████╗ ██╗   ██╗███████╗███╗   ██╗
 ██║ ██╔╝██╔══██╗██║   ██║██╔════╝████╗  ██║
 █████╔╝ ███████║██║   ██║█████╗  ██╔██╗ ██║
 ██╔═██╗ ██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
 ██║  ██╗██║  ██║ ╚████╔╝ ███████╗██║ ╚████║
 ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝
`;

export function getBrandingBanner(): string {
  const lines = KAVEN_BLOCK_ASCII.split("\n");
  const colored = lines
    .map((line) => pc.cyan(line))
    .join("\n");
  
  return `\n${colored}\n${pc.dim("  The Premium Framework Orchestrator for SaaS")}\n`;
}

export const THEME = {
  primary: pc.cyan,
  secondary: pc.magenta,
  success: pc.green,
  warning: pc.yellow,
  error: pc.red,
  dim: pc.dim,
};
