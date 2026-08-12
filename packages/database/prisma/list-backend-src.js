const fs = require('fs');
const files = fs.readdirSync('c:/Users/ys070/amdox-erp/apps/backend/src');
console.log("Files in backend src:", files);
process.exit(0);
