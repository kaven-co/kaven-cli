const fs = require('fs');
let content = fs.readFileSync('tests/unit/commands/marketplace/list.test.ts', 'utf8');

// Fix mock.method().mockImplementation -> mock.method() directly
content = content.replace(/mock\.method\(([^,]+),\s*"([^"]+)"\)\s*\.mockImplementation\(([\s\S]*?)\);/g, 'mock.method($1, "$2", $3);');

fs.writeFileSync('tests/unit/commands/marketplace/list.test.ts', content);
