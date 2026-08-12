const fs = require('fs');
const content = fs.readFileSync('c:/Users/ys070/amdox-erp/apps/backend/src/modules/auth/auth.service.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('getMe') || line.includes('async getMe')) {
    console.log(`L${i+1}: ${line.trim()}`);
    // print some context lines
    for (let j = Math.max(0, i-5); j < Math.min(lines.length, i+30); j++) {
      console.log(`  ${j+1}: ${lines[j].trim()}`);
    }
  }
});
process.exit(0);
