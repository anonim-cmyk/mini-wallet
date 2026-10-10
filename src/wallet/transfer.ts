import { pool } from "../db";

export async function transfer(
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  createdBy: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Amount harus berupa bilangan bulat dan lebih dari 0");
  }

  if (fromAccountId === toAccountId)
    throw new Error("Pengirim dan Penerima tidak boleh sama");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accountRes = await client.query(
      "SELECT id, balance, type FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE",
      [fromAccountId, toAccountId],
    );

    if (accountRes.rows.length < 2)
      throw new Error("Salah satu akun tidak di temukan");

    if (accountRes.rows.some((r) => r.type !== "user")) {
      throw new Error("Transfer hanya antar akun user");
    }

    const sender = accountRes.rows.find((r) => r.id === String(fromAccountId));

    if (Number(sender.balance) < amount) throw new Error("Saldo tidak cukup");

    const txRes = await client.query(
      `INSERT INTO transactions (type, status, amount, created_by) VALUES ('transfer', 'success', $1, $2) RETURNING id`,
      [amount, createdBy],
    );

    const transactionId = txRes.rows[0].id;

    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount)
   VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
      [transactionId, fromAccountId, toAccountId, amount],
    );

    await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [amount, fromAccountId],
    );

    await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [amount, toAccountId],
    );

    await client.query("COMMIT");
    return { success: true, transactionId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
