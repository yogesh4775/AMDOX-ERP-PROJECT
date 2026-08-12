const fs = require('fs');
const content = fs.readFileSync('src/modules/payroll/payroll.service.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('version') || line.includes('expectedVersion') || line.includes('ConflictException')) {
    console.log(`${index + 1}: ${line}`);
  }
});
