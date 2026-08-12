const fs = require('fs');
const content = fs.readFileSync('../../packages/database/prisma/schema.prisma', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('model Employee ')) {
    console.log(`${index + 1}: ${line}`);
    // print next 40 lines
    for (let i = 1; i <= 40; i++) {
      console.log(`${index + 1 + i}: ${lines[index + i]}`);
    }
  }
});
