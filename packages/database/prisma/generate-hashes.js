const argon2 = require('argon2');

async function main() {
  const p1 = "Password_1234_Special!";
  const p2 = "Admin@123";

  const h1 = await argon2.hash(p1, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const h2 = await argon2.hash(p2, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  console.log(`Hash for "${p1}": ${h1}`);
  console.log(`Hash for "${p2}": ${h2}`);
}

main().catch(console.error);
