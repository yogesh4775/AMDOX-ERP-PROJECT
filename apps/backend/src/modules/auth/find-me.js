const fs = require('fs');
const content = fs.readFileSync('c:/Users/ys070/amdox-erp/apps/backend/src/modules/auth/auth.service.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('getMe(') || line.includes('login(')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
