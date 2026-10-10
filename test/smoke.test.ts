import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../src/db";

afterAll(async () => {
  await pool.end();
});

describe("Koneksi database uji", () => {
  it("terhubung ke wallet_test", async () => {
    const res = await pool.query("select current_database() as db");
    expect(res.rows[0].db).toBe("wallet_test");
  });
});
