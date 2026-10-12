import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db";
import { topUp } from "../src/wallet/top-up";
import { transfer } from "../src/wallet/transfer";
import { getHistory } from "../src/wallet/history";
import { resetDb, createUserWithAccount } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("getHistory", () => {
  it("keyset pagination: 25 entri, 3 halaman, tanpa dobel", async () => {
    // 1. SIAPKAN: saldo awal 10000 lewat helper = 1 entri;
    //    lalu 24 transfer @10 => total 25 entri untuk pengirim
    const sender = await createUserWithAccount("a@t.com", 10000);
    const receiver = await createUserWithAccount("b@t.com", 0);
    for (let i = 0; i < 24; i++) {
      await transfer(
        sender.accountId,
        receiver.accountId,
        10,
        randomUUID(),
        sender.userId,
      );
    }

    // 2. JALANKAN: ambil 3 halaman berurutan
    const p1 = await getHistory(sender.accountId, 10);
    // TODO A: p2 dengan cursor p1.nextCursor
    const p2 = await getHistory(
      sender.accountId,
      10,
      p1.nextCursor ?? undefined,
    );
    // TODO B: p3 dengan cursor p2.nextCursor
    const p3 = await getHistory(
      sender.accountId,
      10,
      p2.nextCursor ?? undefined,
    );
    // 3. PERIKSA
    // TODO C: panjang items: 10, 10, 5
    expect(p1.items.length).toBe(10);
    expect(p2.items.length).toBe(10);
    expect(p3.items.length).toBe(5);
    // TODO D: gabungkan semua id, pastikan 25 id unik (new Set(ids).size)
    const ids = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(25);
    // TODO E: ids menurun (ids[i] > ids[i+1])

    for (let i = 0; i < ids.length - 1; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i + 1]);
    }
  });
});
