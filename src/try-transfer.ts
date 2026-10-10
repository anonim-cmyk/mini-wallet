import { pool } from "./db";
import { transfer } from "./wallet/transfer";

async function main() {
  const acc = await pool.query(
    `SELECT id as account_id, user_id from accounts where type = 'user' ORDER BY id LIMIT 2`,
  );

  if (acc.rows.length < 2) {
    throw new Error("Butuh dua akun user untuk menguji transfer");
  }

  const sender = acc.rows[0];
  const receiver = acc.rows[1];

  const result = await transfer(
    Number(sender.account_id),
    Number(receiver.account_id),
    300,
    sender.user_id,
  );
  console.log("hasil: ", result);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
