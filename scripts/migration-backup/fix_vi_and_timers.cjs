const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Fix vi.spyOn -> mock.method
  content = content.replace(/vi\s*\.\s*spyOn\(\s*([^,]+)\s*,\s*"([^"]+)"\s*\)/g, 'mock.method($1, "$2")');
  
  // Fix vi.fn -> mock.fn
  content = content.replace(/vi\.fn\(/g, 'mock.fn(');
  content = content.replace(/typeof vi\.fn/g, 'typeof mock.fn');
  
  // Remove mock.timers.enable() to prevent ERR_INVALID_STATE
  content = content.replace(/mock\.timers\.enable\(\);\s*\/\/[^\n]+/g, '');
  content = content.replace(/mock\.timers\.enable\(\);/g, '');
  
  // Fix mockResolvedValue / mockReturnValue
  content = content.replace(/\.mockResolvedValue\(\s*([\s\S]*?)\s*\)(?=[;,)])/g, '.mock.mockImplementation(() => Promise.resolve($1))');
  content = content.replace(/\.mockReturnValue\(\s*([\s\S]*?)\s*\)(?=[;,)])/g, '.mock.mockImplementation(() => $1)');
  content = content.replace(/\.mockRejectedValue\(\s*([\s\S]*?)\s*\)(?=[;,)])/g, '.mock.mockImplementation(() => Promise.reject($1))');

  // One specific multi-line mockResolvedValue
  content = content.replace(/mock\.fn\(\)\.mock\./g, 'mock.fn().mock.');
  
  fs.writeFileSync(file, content);
}

fixFile('tests/unit/commands/marketplace/install.test.ts');
fixFile('tests/unit/commands/marketplace/list.test.ts');
