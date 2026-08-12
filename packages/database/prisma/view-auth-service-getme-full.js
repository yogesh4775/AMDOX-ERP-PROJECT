const fs = require('fs');
const content = fs.readFileSync('c:/Users/ys070/amdox-erp/apps/backend/src/modules/auth/auth.service.ts', 'utf8');
const lines = content.split('\n');
for (let i = 1179; i < 1240; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
process.exit(0);
