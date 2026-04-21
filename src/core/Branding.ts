import pc from "picocolors";

const KAVEN_ASCII = `
   __  __                             
  / / / /__ _ _  _____  ____          
 / /_/ / _ \\ | |/ / _ \\/ __ \\         
/ __  /  __/ | / /  __/ / / /         
/_/ /_/\\___/ |__/ \\___/_/ /_/ CLI     
`;


export function getBrandingBanner(): string {
  const lines = KAVEN_ASCII.split("\n");
  const colored = lines
    .map((line) => pc.cyan(line))
    .join("\n");
  
  return `\n${colored}\n${pc.dim("  The Official Kaven Framework Orchestrator")}\n`;
}

export const THEME = {
  primary: pc.cyan,
  secondary: pc.magenta,
  success: pc.green,
  warning: pc.yellow,
  error: pc.red,
  dim: pc.dim,
};
