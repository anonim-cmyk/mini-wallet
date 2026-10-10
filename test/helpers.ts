import { pool } from "../src/db";
import { topUp } from "../src/wallet/top-up";

export async function resetDb() {
  await pool.query(
    "TRUNCATE table ledger_entries, transactions, accounts, users RESTART IDENTITY CASCADE",
  );

  await pool.query("INSERT INTO accounts (type) VALUES ('system')");
}

export async function createUserWithAccount(email: string, balance: number) {
  const user = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
    [email],
  );

  const userId = user.rows[0].id;

  const account = await pool.query(
    "INSERT INTO accounts (user_id) values ($1) RETURNING id",
    [userId],
  );

  const accountId = Number(account.rows[0].id);

  if (balance > 0) {
    await topUp(accountId, balance, userId);
  }

  return { userId, accountId };
}
