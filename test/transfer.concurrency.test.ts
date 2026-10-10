import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { pool } from "../src/db";
import { transfer } from "../src/wallet/transfer";
import { resetDb, createUserWithAccount } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("transfer konkuren", () => {
  it("100 transfer @100 dari saldo 1000: tepat 10 sukses, saldo tidak minus", async () => {
    const sender = await createUserWithAccount("a@t.com", 1000);
    const receiver = await createUserWithAccount("b@t.com", 0);

    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () =>
        transfer(sender.accountId, receiver.accountId, 100, sender.userId),
      ),
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected");

    // 1. expect ok toBe 10
    expect(ok).toBe(10);
    // 2. expect failed.length toBe 90
    expect(failed.length).toBe(90);

    for (const r of failed) {
      expect((r as PromiseRejectedResult).reason.message).toBe(
        "Saldo tidak cukup",
      );
    }
    // 3. cek saldo pengirim 0 dan penerima 1000 (query accounts)
    const balances = await pool.query(
      "SELECT id, balance FROM accounts WHERE id IN ($1, $2)",
      [sender.accountId, receiver.accountId],
    );

    const bal = Object.fromEntries(
      balances.rows.map((r) => [r.id, Number(r.balance)]),
    );

    expect(bal[sender.accountId]).toBe(0);
    expect(bal[receiver.accountId]).toBe(1000);
    // 4. cek sum(ledger) per akun sama dengan balance
    const check = await pool.query(`
    SELECT a.id, a.balance::bigint AS balance,
            COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END), 0)::bigint AS dari_ledger
    FROM accounts a
    LEFT JOIN ledger_entries l ON l.account_id = a.id
    GROUP BY a.id
`);

    for (const row of check.rows) {
      expect(Number(row.dari_ledger)).toBe(Number(row.balance));
    }
  });
});
