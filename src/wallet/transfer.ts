import { createHash } from "node:crypto";
import { pool } from "../db";

export async function transfer(
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  idempotencyKey: string,
  createdBy: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Amount harus berupa bilangan bulat dan lebih dari 0");
  }

  if (fromAccountId === toAccountId) {
    throw new Error("Pengirim dan Penerima tidak boleh sama");
  }

  const requestHash = createHash("sha256")
    .update(`${fromAccountId}:${toAccountId}:${amount}`)
    .digest("hex");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Cek idempotency key (sebelum menyentuh saldo)
    const ins = await client.query(
      `INSERT INTO idempotency_keys (user_id, key, request_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key) DO NOTHING`,
      [createdBy, idempotencyKey, requestHash],
    );

    if (ins.rowCount === 0) {
      // Key sudah pernah dipakai
      const old = await client.query(
        "SELECT request_hash, transaction_id FROM idempotency_keys WHERE user_id = $1 AND key = $2",
        [createdBy, idempotencyKey],
      );

      if (old.rows[0].request_hash !== requestHash) {
        throw new Error("Idempotency key dipakai untuk request yang berbeda");
      }

      await client.query("COMMIT");
      return {
        success: true,
        transactionId: old.rows[0].transaction_id,
        replayed: true,
      };
    }

    // 2. Key baru: kunci akun (urut id), cek saldo
    const accountRes = await client.query(
      "SELECT id, balance, type FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE",
      [fromAccountId, toAccountId],
    );

    if (accountRes.rows.length < 2) {
      throw new Error("Salah satu akun tidak ditemukan");
    }

    if (accountRes.rows.some((r) => r.type !== "user")) {
      throw new Error("Transfer hanya antar akun user");
    }

    const sender = accountRes.rows.find((r) => r.id === String(fromAccountId));

    if (Number(sender.balance) < amount) {
      throw new Error("Saldo tidak cukup");
    }

    // 3. Catat transaksi dan ledger
    const txRes = await client.query(
      `INSERT INTO transactions (type, status, amount, created_by)
       VALUES ('transfer', 'success', $1, $2) RETURNING id`,
      [amount, createdBy],
    );
    const transactionId = txRes.rows[0].id;

    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount)
       VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
      [transactionId, fromAccountId, toAccountId, amount],
    );

    // 4. Update saldo
    await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [amount, fromAccountId],
    );
    await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [amount, toAccountId],
    );

    // 5. Simpan hasil di idempotency key
    await client.query(
      "UPDATE idempotency_keys SET transaction_id = $1 WHERE user_id = $2 AND key = $3",
      [transactionId, createdBy, idempotencyKey],
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
