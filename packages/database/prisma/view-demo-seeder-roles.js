const fs = require('fs');
const content = fs.readFileSync('c:/Users/ys070/amdox-erp/packages/database/prisma/demo-seeder.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('role') || line.includes('permission') || line.includes('Role') || line.includes('Permission') || line.includes('create') || line.includes('upsert')) {
    if (line.includes('Role') || line.includes('Permission') || line.includes('user') || line.includes('User')) {
      console.log(`L${i+1}: ${line.trim()}`);
    }
  }
});
process.exit(0);
