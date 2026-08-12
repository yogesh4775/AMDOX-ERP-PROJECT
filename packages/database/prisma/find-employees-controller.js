const fs = require('fs');
const path = require('path');

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('class EmployeesController') || content.includes('class EmployeeController')) {
    console.log(`Found: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.ts')) {
      searchInFile(fullPath);
    }
  }
}

walkDir('c:/Users/ys070/amdox-erp/apps/backend/src');
process.exit(0);
