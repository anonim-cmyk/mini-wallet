import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../src/db";
import { createUserWithAccount, resetDb } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("Koneksi database uji", () => {
  it("terhubung ke wallet_test", async () => {
    const res = await pool.query("select current_database() as db");
    expect(res.rows[0].db).toBe("wallet_test");
  });

  it("helper membuat data awal yang benar", async () => {
    await resetDb();
    const s = await createUserWithAccount("a@t.com", 1000);
    const r = await pool.query("select balance from accounts where id = $1", [
      s.accountId,
    ]);
    expect(Number(r.rows[0].balance)).toBe(1000);
  });
});
