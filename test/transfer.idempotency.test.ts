import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db";
import { transfer } from "../src/wallet/transfer";
import { resetDb, createUserWithAccount } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("idempotency", () => {
  it("key sama dipakai 20 kali: hanya diproses sekali", async () => {
    // 1. SIAPKAN
    const sender = await createUserWithAccount("a@t.com", 1000);
    const receiver = await createUserWithAccount("b@t.com", 0);
    const key = randomUUID(); // SATU key, dipakai semua panggilan

    // 2. JALANKAN
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        // TODO A: panggil transfer dengan key yang sama
        transfer(sender.accountId, receiver.accountId, 100, key, sender.userId),
      ),
    );

    // 3. PERIKSA
    // TODO B: semua 20 hasil harus "fulfilled"
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(20);
    // TODO C: saldo pengirim harus 900
    const bal = await pool.query("SELECT balance FROM accounts WHERE id = $1", [
      sender.accountId,
    ]);
    expect(Number(bal.rows[0].balance)).toBe(900);
  });
});
