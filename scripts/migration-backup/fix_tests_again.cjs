const fs = require('fs');

// Fix install.test.ts
let installContent = fs.readFileSync('tests/unit/commands/marketplace/install.test.ts', 'utf8');

const importsToAdd = `
import { marketplaceInstall } from "../../../../src/commands/marketplace/install.js";
import {
  AuthenticationError,
  LicenseRequiredError,
  NetworkError,
} from "../../../../src/infrastructure/errors.js";
import type { Module, DownloadToken } from "../../../../src/types/marketplace.js";
import { AuthService } from "../../../../src/core/AuthService.js";
import { MarketplaceClient } from "../../../../src/infrastructure/MarketplaceClient.js";
import { ModuleInstaller } from "../../../../src/core/ModuleInstaller.js";
import * as tarModule from "tar";
import fs from "fs-extra";
`;

if (!installContent.includes('import { marketplaceInstall }')) {
  installContent = installContent.replace('function makeFetchResponse', importsToAdd + '\nfunction makeFetchResponse');
}

// Fix mock.method().mockImplementation
installContent = installContent.replace(/mock\.method\(([^,]+),\s*"([^"]+)"(?:,\s*\(\)\s*=>\s*\{\})?\)\s*\.mockImplementation\(([\s\S]*?)\)(;?)/g, 'mock.method($1, "$2", $3)$4');

fs.writeFileSync('tests/unit/commands/marketplace/install.test.ts', installContent);

// Fix list.test.ts
let listContent = fs.readFileSync('tests/unit/commands/marketplace/list.test.ts', 'utf8');

// Fix mock.method().mockImplementation
listContent = listContent.replace(/mock\.method\(([^,]+),\s*"([^"]+)"(?:,\s*\(\)\s*=>\s*\{\})?\)\s*\.mockImplementation\(([\s\S]*?)\)(;?)/g, 'mock.method($1, "$2", $3)$4');

fs.writeFileSync('tests/unit/commands/marketplace/list.test.ts', listContent);

