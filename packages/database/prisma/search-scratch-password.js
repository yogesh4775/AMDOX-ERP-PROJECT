const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/ys070/.gemini/antigravity/brain/09d9752f-a38b-4711-a3d1-7c4bb6664cbc/scratch';
const files = fs.readdirSync(dir);
files.forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.ts')) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (content.includes('password') || content.includes('Password') || content.includes('hash') || content.includes('argon')) {
      console.log(`=== File: ${file} ===`);
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('password') || line.includes('Password') || line.includes('hash') || line.includes('argon')) {
          console.log(`  L${i+1}: ${line.trim()}`);
        }
      });
    }
  }
});
process.exit(0);
