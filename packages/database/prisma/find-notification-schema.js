const fs = require('fs');

const schema = fs.readFileSync('c:/Users/ys070/amdox-erp/packages/database/prisma/schema.prisma', 'utf8');
const lines = schema.split('\n');
let inside = false;
for (const line of lines) {
  if (line.includes('model Notification ')) {
    inside = true;
  }
  if (inside) {
    console.log(line);
    if (line.trim() === '}') {
      inside = false;
    }
  }
}
process.exit(0);
