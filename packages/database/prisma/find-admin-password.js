const fs = require('fs');

function search(file) {
  const content = fs.readFileSync(file, 'utf8');
  console.log(`=== Search in ${file} ===`);
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('admin') || line.includes('password') || line.includes('Password') || line.includes('@amdox.com')) {
      console.log(`L${i+1}: ${line.trim()}`);
    }
  });
}

search('c:/Users/ys070/amdox-erp/packages/database/prisma/seed.ts');
search('c:/Users/ys070/amdox-erp/packages/database/prisma/demo-seeder.ts');
process.exit(0);
