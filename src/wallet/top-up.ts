import { pool } from "../db";

export async function topUp(
  accountId: number,
  amount: number,
  createdBy: string,
) {
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new Error("Amount harus berupa bilangan bulat dan lebih dari 0");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const systemAccountRes = await client.query(
      "SELECT id from accounts WHERE type = 'system' LIMIT 1",
    );
    const systemAccountId = systemAccountRes.rows[0]?.id;
    if (!systemAccountId) throw new Error("Akun sistem tidak ditemukan");

    const accountsRes = await client.query(
      `SELECT id, balance FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE`,
      [accountId, systemAccountId],
    );

    if (accountsRes.rows.length < 2) {
      throw new Error("Salah satu akun tidak ditemukan");
    }

    const txRes = await client.query(
      "INSERT INTO transactions (type, status, amount, created_by) VALUES ('topup', 'success', $1, $2) RETURNING id",
      [amount, createdBy],
    );
    const transactionId = txRes.rows[0].id;

    await client.query(
      "INSERT INTO ledger_entries (transaction_id, account_id, direction, amount) values ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)",
      [transactionId, systemAccountId, accountId, amount],
    );

    await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [amount, systemAccountId],
    );
    await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [amount, accountId],
    );

    await client.query("COMMIT");
    return { success: true, transactionId };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("TopUp failed, transaction rolled back: ", error);
    throw error;
  } finally {
    await client.release();
  }
}
