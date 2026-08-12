const fs = require('fs');

const dotenvContent = fs.readFileSync('c:/Users/ys070/amdox-erp/.env', 'utf8');

function getEnvVar(name) {
  const match = dotenvContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const raw = getEnvVar('CORS_ORIGINS');
const parsed = raw ? raw.split(",").map((o) => o.trim().replace(/^['"]|['"]$/g, "")) : [];

console.log("=== CONFIGURATION AUDIT ===");
console.log("CORS Origins Raw:", raw);
console.log("CORS Origins Parsed:", parsed);
console.log("JWT Access Secret Raw:", getEnvVar('JWT_ACCESS_SECRET'));
console.log("JWT Access Secret Parsed:", (getEnvVar('JWT_ACCESS_SECRET') || "").replace(/^['"]|['"]$/g, ""));
console.log("Port:", getEnvVar('PORT'));
