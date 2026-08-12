const argon2 = require('argon2');

const hash = '$argon2id$v=19$m=65536,t=3,p=4$NcUZZVtNtPQYVEE0JqHUeQ$R8RBf8URpIINyyIN7gL/tKQRxq99OIpIErs4f4vvP/s';

async function check() {
  console.log("=== CHECKING PASSWORD HASH ===");
  
  const p1 = "Password_1234_Special!";
  const p2 = "Admin@123";
  
  const ok1 = await argon2.verify(hash, p1);
  const ok2 = await argon2.verify(hash, p2);
  
  console.log(`Verify "${p1}":`, ok1);
  console.log(`Verify "${p2}":`, ok2);
}

check().catch(console.error);
