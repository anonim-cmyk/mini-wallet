import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db";
import { transfer } from "../src/wallet/transfer";
import { resetDb, createUserWithAccount } from "./helpers";
import { topUp } from "../src/wallet/top-up";

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

  it("key sama tapi jumlah berbeda: ditolak", async () => {
    // 1. SIAPKAN
    const sender = await createUserWithAccount("a@t.com", 1000);
    const receiver = await createUserWithAccount("b@t.com", 0);
    const key = randomUUID();

    // 2. JALANKAN
    // TODO A: transfer 100 dengan key (await, harus berhasil)
    await transfer(
      sender.accountId,
      receiver.accountId,
      100,
      key,
      sender.userId,
    );

    // TODO B: transfer 500 dengan key yang sama
    //         bungkus dengan expect(...).rejects.toThrow("Idempotency key dipakai untuk request yang berbeda")
    await expect(
      transfer(sender.accountId, receiver.accountId, 500, key, sender.userId),
    ).rejects.toThrow("Idempotency key dipakai untuk request yang berbeda");

    const bal = await pool.query("SELECT balance FROM accounts WHERE id = $1", [
      sender.accountId,
    ]);

    // 3. PERIKSA
    // TODO C: saldo pengirim tetap 900
    expect(Number(bal.rows[0].balance)).toBe(900);
  });

  it("transfer gagal lalu retry dengan key sama: diproses ulang", async () => {
    // 1. SIAPKAN
    const sender = await createUserWithAccount("a@t.com", 50);
    const receiver = await createUserWithAccount("b@t.com", 0);
    const key = randomUUID();

    // 2. JALANKAN
    // TODO A: transfer 100 dengan key, harus ditolak "Saldo tidak cukup"
    //         (pola: await expect(transfer(...)).rejects.toThrow("Saldo tidak cukup"))
    await expect(
      transfer(sender.accountId, receiver.accountId, 100, key, sender.userId),
    ).rejects.toThrow("Saldo tidak cukup");

    // TODO B: isi saldo pengirim 100 lagi: await topUp(sender.accountId, 100, sender.userId)
    //         (import topUp dari "../src/wallet/top-up")
    await topUp(sender.accountId, 100, sender.userId);

    // TODO C: transfer 100 dengan key yang SAMA, harus berhasil
    //         dan hasilnya TIDAK replayed (expect(result.replayed).toBeUndefined())
    const result = await transfer(
      sender.accountId,
      receiver.accountId,
      100,
      key,
      sender.userId,
    );
    expect(result.replayed).toBeUndefined();
    // 3. PERIKSA
    // TODO D: saldo pengirim = 50 + 100 - 100 = 50, saldo penerima = 100
    const balance = await pool.query(
      "SELECT id, balance FROM accounts WHERE id IN ($1, $2)",
      [sender.accountId, receiver.accountId],
    );
    console.log(balance);

    const bal = Object.fromEntries(
      balance.rows.map((r) => [r.id, Number(r.balance)]),
    );

    expect(bal[sender.accountId]).toBe(50);
    expect(bal[receiver.accountId]).toBe(100);
  });
});
