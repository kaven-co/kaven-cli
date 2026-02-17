import { Command } from 'commander';
import chalk from 'chalk';
import { LicenseService } from '../../core/LicenseService.js';

export function buildLicenseStatusCommand(): Command {
  return new Command('status')
    .description('Show license status and tier information')
    .argument('[license-key]', 'License key to check (uses stored license if omitted)')
    .action(async (licenseKey?: string) => {
      const service = new LicenseService();

      // Resolve key from arg or environment
      const key = licenseKey ?? process.env.KAVEN_LICENSE_KEY;
      if (!key) {
        console.error(chalk.red('✗ No license key provided. Pass as argument or set KAVEN_LICENSE_KEY.'));
        process.exit(1);
      }

      try {
        console.log(chalk.dim('Checking license status...'));
        const status = await service.getLicenseStatus(key);

        console.log('\n' + chalk.bold('License Status') + '\n');
        console.log(`  Key:       ${chalk.dim(status.key.substring(0, 16) + '...')}`);
        console.log(`  Tier:      ${chalk.magenta(status.tier)}`);
        if (status.expiresAt) {
          const days = status.daysUntilExpiry;
          const expiryColor = days !== null && days < 30 ? chalk.red : chalk.green;
          console.log(`  Expires:   ${expiryColor(status.expiresAt)}${days !== null ? chalk.dim(` (${days} days)`) : ''}`);
        } else {
          console.log(`  Expires:   ${chalk.green('Never')}`);
        }
        console.log();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to check license status';
        console.error(chalk.red('✗ ' + message));
        process.exit(1);
      }
    });
}
