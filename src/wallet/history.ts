import { pool } from "../db";

export async function getHistory(
  accountId: number,
  limit: number,
  cursor?: number,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit harus bilangan bulat 1 sampai 100");
  }

  const res =
    cursor === undefined
      ? await pool.query(
          `SELECT id, transaction_id, direction, amount, created_at
           FROM ledger_entries
           WHERE account_id = $1
           ORDER BY id DESC
           LIMIT $2`,
          [accountId, limit],
        )
      : await pool.query(
          `SELECT id, transaction_id, direction, amount, created_at
           FROM ledger_entries
           WHERE account_id = $1 AND id < $2
           ORDER BY id DESC
           LIMIT $3`,
          [accountId, cursor, limit],
        );

  const items = res.rows.map((r) => ({
    ...r,
    id: Number(r.id),
    amount: Number(r.amount),
  }));
  const nextCursor = items.length === limit ? items[items.length - 1].id : null;

  return { items, nextCursor };
}
