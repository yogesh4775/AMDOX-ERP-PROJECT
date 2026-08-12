const fs = require('fs');
const content = fs.readFileSync('c:/Users/ys070/amdox-erp/packages/database/prisma/demo-seeder.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('admin') || line.includes('sales') || line.includes('warehouse') || line.includes('employee')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
process.exit(0);
