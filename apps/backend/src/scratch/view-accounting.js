const fs = require('fs');
const content = fs.readFileSync('src/modules/leave/leave.controller.ts', 'utf8');
const lines = content.split('\n');
for (let i = 25; i <= 55; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
