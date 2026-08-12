const argon2 = require('argon2');

const users = [
  { email: 'sales@amdox.com', hash: '$argon2id$v=19$m=65536,t=3,p=4$jBijbgT+LkWs4xOyA5JliA$ZGRdJY6KbwV6N+Ql9f7DyRM1lUv+gejujQ0GmSQjG8U' },
  { email: 'warehouse@amdox.com', hash: '$argon2id$v=19$m=65536,t=3,p=4$pfvjgqyvrR7aAnrwCeLueg$+sIMuUw+MpDdXH8fzkkUA+18VRn2uRu5wTh8rfll4aE' },
  { email: 'employee@amdox.com', hash: '$argon2id$v=19$m=65536,t=3,p=4$sujSK2Inj8e1fKsslli+dg$qaSp85BOtDtin1tUIZ0ZVb3Jy1jkcR9ymugmSGTw2/s' },
  { email: 'admin@amdox.com', hash: '$argon2id$v=19$m=65536,t=3,p=4$vsIDN6sXrrE+oYQaWw/NXg$Qo558Wo0aifixpUr1AOT7W8khU/02DxKhwpLpmcPKpI' }
];

const passwords = [
  "Password_1234_Special!",
  "Admin@123",
  "sales",
  "warehouse",
  "employee",
  "admin",
  "salesPassword",
  "warehousePassword",
  "employeePassword",
  "Password123",
  "Password123!",
  "Password@123",
  "Amdox@123",
  "Amdox123"
];

async function main() {
  console.log("=== CHECKING ALL USERS PASSWORDS ===");
  for (const u of users) {
    console.log(`Checking user: ${u.email}`);
    let found = false;
    for (const pw of passwords) {
      const ok = await argon2.verify(u.hash, pw);
      if (ok) {
        console.log(`  MATCH: "${pw}"`);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`  NO MATCH FOUND`);
    }
  }
}

main().catch(console.error);
