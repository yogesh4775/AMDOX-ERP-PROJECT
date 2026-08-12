const fs = require('fs');
const content = fs.readFileSync('c:/Users/ys070/amdox-erp/packages/database/prisma/seed.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('role') || line.includes('permission') || line.includes('Role') || line.includes('Permission')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
process.exit(0);
