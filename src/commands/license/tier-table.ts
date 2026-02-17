import Table from 'cli-table3';
import chalk from 'chalk';

const TIERS = [
  { name: 'STARTER', price: '$149', projects: '1', tenants: '10', marketplace: false },
  { name: 'COMPLETE', price: '$399', projects: '1', tenants: 'Unlimited', marketplace: false },
  { name: 'PRO', price: '$799', projects: '5', tenants: 'Unlimited', marketplace: true },
  { name: 'ENTERPRISE', price: 'Custom', projects: 'Unlimited', tenants: 'Unlimited', marketplace: true },
];

function colorTier(tier: string): string {
  switch (tier.toUpperCase()) {
    case 'STARTER': return chalk.green(tier);
    case 'COMPLETE': return chalk.yellow(tier);
    case 'PRO': return chalk.magenta(tier);
    case 'ENTERPRISE': return chalk.cyan(tier);
    default: return tier;
  }
}

export function printTierComparisonTable(userTier: string, requiredTier: string): void {
  console.log(chalk.red('\n✗ License tier insufficient\n'));
  console.log(`  Your tier:     ${colorTier(userTier)}`);
  console.log(`  Required tier: ${colorTier(requiredTier)}\n`);

  const table = new Table({
    head: ['Tier', 'Price', 'Projects', 'Tenants', 'Marketplace'],
    style: { head: ['cyan'] },
  });

  for (const t of TIERS) {
    const isUser = t.name === userTier.toUpperCase();
    const isRequired = t.name === requiredTier.toUpperCase();
    const marker = isRequired ? chalk.yellow(' ← required') : isUser ? chalk.dim(' ← you') : '';

    table.push([
      colorTier(t.name) + marker,
      t.price,
      t.projects,
      t.tenants,
      t.marketplace ? chalk.green('✓') : chalk.dim('✗'),
    ]);
  }

  console.log(table.toString());
  console.log(chalk.dim('\n  Upgrade at: https://kaven.dev/pricing\n'));
}
