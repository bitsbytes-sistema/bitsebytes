const bcrypt = require("bcrypt");

async function run() {
  const hash = await bcrypt.hash("1802", 10);
  console.log(hash);
}

run();