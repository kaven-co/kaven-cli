import { Command } from 'commander';
import { buildLicenseStatusCommand } from './status.js';

export function buildLicenseCommand(): Command {
  const cmd = new Command('license').description('Manage Kaven licenses');
  cmd.addCommand(buildLicenseStatusCommand());
  return cmd;
}
