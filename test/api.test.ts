import { afterAll } from "vitest";
import request from "supertest";
import { pool } from "../src/db";
import { describe } from "vitest";
import { it } from "vitest";
import { app } from "../src/app";
import { expect } from "vitest";
import { resetDb } from "./helpers";
import { beforeEach } from "vitest";
import { topUp } from "../src/wallet/top-up";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

async function registerAndLogin(email: string) {
  await request(app).post("/register").send({ email, password: "rahasia123" });
  const login = await request(app)
    .post("/login")
    .send({ email, password: "rahasia123" });
  return login.body.token as string;
}

async function getIds(email: string) {
  const r = await pool.query(
    `SELECT u.id AS user_id, a.id AS account_id
     FROM users u JOIN accounts a ON a.user_id = u.id
     WHERE u.email = $1`,
    [email],
  );
  return {
    userId: r.rows[0].user_id as string,
    accountId: Number(r.rows[0].account_id),
  };
}

describe("Auth", () => {
  it("register lalu login -> dapat token", async () => {
    const reg = await request(app)
      .post("/register")
      .send({ email: "a@x.com", password: "rahasia123" });
    expect(reg.status).toBe(201);

    const login = await request(app)
      .post("/login")
      .send({ email: "a@x.com", password: "rahasia123" });
    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe("string");
  });

  it("register email sama dua kali -> 409", async () => {
    const first = await request(app)
      .post("/register")
      .send({ email: "a@x.com", password: "rahasia123" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/register")
      .send({ email: "a@x.com", password: "rahasia123" });
    expect(second.status).toBe(409);
  });
});

describe("API dasar", () => {
  it("GET /health -> 200", async () => {
    const result = await request(app).get("/health");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok" });
  });

  it("GET /history -> 401", async () => {
    const result = await request(app).get("/history");
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "Unauthorized" });
  });
});

describe("transfer", () => {
  it("transfer sukses lalu reply dengan key sama: saldo berkurang sekali", async () => {
    const tokenA = await registerAndLogin("a@x.com");
    await registerAndLogin("b@x.com");

    const a = await getIds("a@x.com");
    const b = await getIds("b@x.com");

    await topUp(a.accountId, 1000, a.userId);

    const first = await request(app)
      .post("/transfer")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", "k1")
      .send({ toAccountId: b.accountId, amount: 100 });
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);

    const second = await request(app)
      .post("/transfer")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", "k1")
      .send({ toAccountId: b.accountId, amount: 100 });

    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.transactionId).toBe(first.body.transactionId);

    const bal = await pool.query("SELECT balance FROM accounts WHERE id = $1", [
      a.accountId,
    ]);
    expect(Number(bal.rows[0].balance)).toBe(900);
  });
});
