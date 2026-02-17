// Mock for 'open' package (until pnpm install works)
export default async function open(url: string): Promise<void> {
  // No-op in tests
  console.log(`[MOCK] Would open: ${url}`);
}
