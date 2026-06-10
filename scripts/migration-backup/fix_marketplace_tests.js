const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // mockSpinner
  content = content.replace(/mock\.fn\(\)\.mockReturnThis\(\)/g, "mock.fn(() => mockSpinner)");
  content = content.replace(/mockSpinner\.([a-zA-Z]+)\.mockReturnThis\(\);/g, "mockSpinner.$1.mock.mockImplementation(() => mockSpinner);");
  
  // mockTelemetry
  content = content.replace(/mock\.fn\(\)\.mockImplementation\(\(\) => Promise\.resolve\(undefined\)\)/g, "mock.fn(() => Promise.resolve(undefined))");
  content = content.replace(/mockTelemetry\.capture\.mockReturnValue\(undefined\);/g, "mockTelemetry.capture.mock.mockImplementation(() => undefined);");
  content = content.replace(/mockTelemetry\.flush\.mockImplementation/g, "mockTelemetry.flush.mock.mockImplementation");
  
  // other mocks
  content = content.replace(/mock\.fn\(\)\.mockImplementation\((.*?)\)/g, "mock.fn($1)");
  content = content.replace(/mock\.fn\(\)\.mockResolvedValue\((.*?)\)/g, "mock.fn(() => Promise.resolve($1))");
  
  // replace .mockImplementation on variables holding mock.fn()
  const mockVars = ['mockGetValidToken', 'mockIsAuthenticated', 'mockGetModule', 'mockCreateDownloadToken', 'mockGetReleaseInfo', 'mockInstall', 'mockIsModuleInstalled', 'mockListModules', 'fetchSpy'];
  
  mockVars.forEach(v => {
    content = content.replace(new RegExp(`\\b${v}\\.mockImplementation\\(`, 'g'), `${v}.mock.mockImplementation(`);
    content = content.replace(new RegExp(`\\b${v}\\.mockRejectedValue\\((.*?)\\)`, 'g'), `${v}.mock.mockImplementation(() => Promise.reject($1))`);
    content = content.replace(new RegExp(`\\b${v}\\.mockResolvedValue\\((.*?)\\)`, 'g'), `${v}.mock.mockImplementation(() => Promise.resolve($1))`);
  });
  
  fs.writeFileSync(file, content);
}

fixFile('tests/unit/commands/marketplace/install.test.ts');
fixFile('tests/unit/commands/marketplace/list.test.ts');
