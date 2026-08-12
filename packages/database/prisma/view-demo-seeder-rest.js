const fs = require('fs');
const content = fs.readFileSync('c:/Users/ys070/amdox-erp/packages/database/prisma/demo-seeder.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('role') || line.includes('Role') || line.includes('rolePermission') || line.includes('roleId') || line.includes('upsert') || line.includes('create')) {
    if (i < 200) {
      console.log(`L${i+1}: ${line.trim()}`);
    }
  }
});
process.exit(0);
