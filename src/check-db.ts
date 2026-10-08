import { pool } from "./db";

async function main() {
  const res = await pool.query("select now() as sekarang");
  console.log(res.rows[0]);
  await pool.end();
}

main();
