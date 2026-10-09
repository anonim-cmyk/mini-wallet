import { pool } from "./db";
import { topUp } from "./wallet/top-up";

async function main() {
  const acc = await pool.query(
    "select id as account_id, user_id from accounts where type = 'user' limit 1",
  );
  const { account_id, user_id } = acc.rows[0];

  const result = await topUp(account_id, 1000, user_id);
  // dibawah ini tes yang salah, total harus bilangan bulat dan lebih dari satu
  // const result = await topUp(account_id, -5, user_id);
  // dibawah ini tes yang salah untuk user, dan harus mengembalikan user tidak di temukan
  // const result = await topUp(9999, 1000, user_id);
  console.log("hasil:", result);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
